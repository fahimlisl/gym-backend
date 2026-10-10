
import { DateTime } from "luxon";

import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

import { Trainer } from "../models/trainer.models.js";
import { StaffSchedule } from "../models/schedule.staff.models.js";
import { TrainerAttendance } from "../models/trainerAttendance.models.js";

import { determineAttendanceType } from "../service/attendanceDecision.service.js";
import { verifyTrainerLocation } from "../service/geoVerification.service.js";
import { verifyTrainerFace } from "../service/faceRecognition.service.js";

const TIMEZONE = "Asia/Kolkata";

export const markTrainerAttendance = asyncHandler(
  async (req, res) => {
    const trainerId = req.user?._id;

    if (!trainerId) {
      throw new ApiError(
        401,
        "Trainer authentication required."
      );
    }

    const now = DateTime.now().setZone(TIMEZONE);
    const today = now.toFormat("yyyy-MM-dd");
    const dayOfWeek = now.weekday % 7;

    const schedule = await StaffSchedule.findOne({
      trainer: trainerId,
      isActive: true,
      daysOfWeek: dayOfWeek,
    }).lean();

    if (!schedule) {
      throw new ApiError(
        404,
        "No active schedule found for today."
      );
    }

    const { latitude, longitude, accuracy } = req.body;

    const locationVerification = verifyTrainerLocation({
      latitude,
      longitude,
      accuracy,
    });

    const faceBuffers = (req.files || []).map(
      (file) => file.buffer
    );

    if (faceBuffers.length !== 3) {
      throw new ApiError(
        400,
        "Exactly three live camera frames are required."
      );
    }

    const trainer = await Trainer.findById(trainerId).select(
      "+faceEmbedding +faceEmbeddings verificationAvatar"
    );

    if (!trainer) {
      throw new ApiError(
        404,
        "Trainer account not found."
      );
    }

    if (!trainer.verificationAvatar?.url) {
      throw new ApiError(
        400,
        "Trainer verification photo has not been enrolled."
      );
    }

    const referenceEmbeddings =
      trainer.faceEmbeddings?.length > 0
        ? trainer.faceEmbeddings.map((embedding) =>
            Array.from(embedding)
          )
        : trainer.faceEmbedding?.length > 0
          ? [Array.from(trainer.faceEmbedding)]
          : [];

    if (referenceEmbeddings.length === 0) {
      throw new ApiError(
        400,
        "Trainer face enrollment is incomplete. Please enroll reference photos."
      );
    }

    const faceVerification = await verifyTrainerFace({
      liveImageBuffers: faceBuffers,
      referenceEmbeddings,
    });

    const todayEvents = await TrainerAttendance.find({
      trainer: trainerId,
      date: today,
    })
      .sort({ createdAt: 1 })
      .lean();

    const decision = determineAttendanceType({
      schedule,
      todayEvents,
      now: now.toJSDate(),
    });

    const attendance = await TrainerAttendance.create({
      trainer: trainerId,
      schedule: schedule._id,
      date: today,
      type: decision.type,
      source: "FACIAL",
    });

    console.log("[ATTENDANCE SAVED]", {
      id: attendance._id.toString(),
      type: attendance.type,
      date: attendance.date,
    });

    return res.status(201).json(
      new ApiResponse(
        201,
        {
          attendance: {
            _id: attendance._id,
            type: attendance.type,
            date: attendance.date,
            time: attendance.createdAt,
            source: attendance.source,
          },

          decision: {
            reason: decision.reason,
            breakName: decision.breakName ?? null,
            excessMinutes: decision.excessMinutes ?? 0,
            lateByMinutes: decision.lateByMinutes ?? 0,
          },

          verification: {
            location: {
              verified: locationVerification.verified,
              accuracy: locationVerification.accuracy,
              distanceFromGym:
                locationVerification.distanceFromGym,
            },

            face: {
              verified: faceVerification.verified,
              similarity: faceVerification.similarity,
              detectionScore:
                faceVerification.detectionScore,
              antiSpoofScore: faceVerification.realScore,
              livenessScore: faceVerification.liveScore,
              acceptedFrames:
                faceVerification.acceptedFrames,
              totalFrames:
                faceVerification.totalFrames,
              referenceCount:
                faceVerification.referenceCount,
            },
          },
        },
        "Attendance recorded successfully."
      )
    );
  }
);
