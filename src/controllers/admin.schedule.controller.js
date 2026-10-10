import mongoose from "mongoose";
import { DateTime } from "luxon";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Trainer } from "../models/trainer.models.js";
import { Admin } from "../models/admin.models.js";
import { StaffSchedule } from "../models/schedule.staff.models.js";
import { TrainerAttendance } from "../models/trainerAttendance.models.js";

const TIMEZONE = "Asia/Kolkata";
const minutes = (value) => {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};
const integerBetween = (value, min, max) =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const validateScheduleBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ApiError(400, "Invalid schedule.");
  const { shiftStart, shiftEnd, gracePeriodMinutes, daysOfWeek, breaks } = body;
  const start = minutes(shiftStart), end = minutes(shiftEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
    throw new ApiError(400, "Shift must start before it ends. Overnight shifts are not supported.");
  if (!integerBetween(gracePeriodMinutes, 0, 120))
    throw new ApiError(400, "Shift grace must be between 0 and 120 minutes.");
  if (!Array.isArray(daysOfWeek) || !daysOfWeek.length || daysOfWeek.length > 7 ||
    new Set(daysOfWeek).size !== daysOfWeek.length ||
    !daysOfWeek.every((day) => integerBetween(day, 0, 6)))
    throw new ApiError(400, "Choose one or more valid working days.");
  if (!Array.isArray(breaks) || breaks.length > 12)
    throw new ApiError(400, "Provide up to 12 scheduled breaks.");
  const checkoutStart = end - gracePeriodMinutes;
  const slots = breaks.map((b, index) => {
    const bs = minutes(b?.startTime), be = minutes(b?.endTime);
    const g = b?.gracePeriodMinutes;
    if (typeof b?.name !== "string" || !b.name.trim() || b.name.trim().length > 50)
      throw new ApiError(400, `Break ${index + 1}: enter a name up to 50 characters.`);
    if (!Number.isFinite(bs) || !Number.isFinite(be) || bs >= be || bs - g < start || be > checkoutStart)
      throw new ApiError(400, `Break ${index + 1} falls outside the permitted shift/break window.`);
    if (!integerBetween(g, 0, 60) || typeof b?.paid !== "boolean")
      throw new ApiError(400, `Break ${index + 1}: invalid grace or paid setting.`);
    return { name: b.name.trim(), startTime: b.startTime, endTime: b.endTime,
      gracePeriodMinutes: g, paid: b.paid, bs, be, outStart: bs - g, outEnd: bs + g };
  }).sort((a, b) => a.bs - b.bs);
  for (let i = 1; i < slots.length; i++) {
    if (slots[i].bs < slots[i - 1].be || slots[i].outStart <= slots[i - 1].outEnd)
      throw new ApiError(400, "Scheduled breaks or their grace windows overlap.");
  }
  return { shiftStart, shiftEnd, gracePeriodMinutes,
    daysOfWeek: [...daysOfWeek].sort((a, b) => a - b),
    breaks: slots.map(({ name, startTime, endTime, gracePeriodMinutes, paid }) =>
      ({ name, startTime, endTime, gracePeriodMinutes, paid }))
  };
};

const authorize = async (req, edit = false) => {
  if (!req.user?._id) throw new ApiError(401, "Admin authentication required.");
  const admin = await Admin.findById(req.user._id).select("isSuperAdmin trainer").lean();
  if (!admin) throw new ApiError(401, "Admin not found.");
  if (!admin.isSuperAdmin && !admin.trainer?.allow) throw new ApiError(403, "Trainer management not permitted.");
  if (edit && !admin.isSuperAdmin && admin.trainer?.isReadOnly)
    throw new ApiError(403, "Trainer management is read-only.");
  return admin;
};

const getTrainer = async (trainerId) => {
  if (!mongoose.isValidObjectId(trainerId)) throw new ApiError(400, "Invalid trainer ID.");
  const exists = await Trainer.exists({ _id: trainerId });
  if (!exists) throw new ApiError(404, "Trainer not found.");
};

const preventChangeDuringAttendance = async (trainerId, session) => {
  const date = DateTime.now().setZone(TIMEZONE).toFormat("yyyy-MM-dd");
  const exists = await TrainerAttendance.findOne({ trainer: trainerId, date }).session(session).select("_id").lean();
  if (exists) throw new ApiError(409, "Attendance already exists today. Change this schedule before the next workday instead.");
};

export const fetchTrainerSchedule = asyncHandler(async (req, res) => {
  await authorize(req);
  await getTrainer(req.params.trainerId);
  const schedule = await StaffSchedule.findOne({ trainer: req.params.trainerId, isActive: true }).lean();
  return res.status(200).json(new ApiResponse(200, { schedule: schedule ?? null }, "Schedule fetched."));
});


export const upsertTrainerSchedule = asyncHandler(
  async (req, res) => {
    await authorize(req, true);
    await getTrainer(req.params.trainerId);

    const normalized = validateScheduleBody(req.body);

    const trainerId = req.params.trainerId;

    try {
      const saved = await StaffSchedule.findOneAndUpdate(
        {
          trainer: trainerId,
        },
        {
          $set: {
            ...normalized,
            isActive: true,
          },

          $setOnInsert: {
            trainer: trainerId,
            createdBy: req.user._id,
          },
        },
        {
          upsert: true,
          returnDocument: "after",
          runValidators: true,
          setDefaultsOnInsert: true,
          sort: {
            isActive: -1,
            updatedAt: -1,
          },
        }
      );

      return res.status(200).json(
        new ApiResponse(
          200,
          { schedule: saved },
          "Trainer schedule saved successfully."
        )
      );
    } catch (error) {
      if (error?.code === 11000) {
        throw new ApiError(
          409,
          "Schedule conflict. Please retry."
        );
      }

      throw error;
    }
  }
);


export const disableTrainerSchedule = asyncHandler(async (req, res) => {
  await authorize(req, true);
  await getTrainer(req.params.trainerId);
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // await preventChangeDuringAttendance(req.params.trainerId, session);
      const result = await StaffSchedule.updateMany(
        { trainer: req.params.trainerId, isActive: true },
        { $set: { isActive: false } }, { session }
      );
      if (result.modifiedCount === 0) throw new ApiError(404, "No active schedule to deactivate.");
    });
  } finally { await session.endSession(); }
  return res.status(200).json(new ApiResponse(200, {}, "Trainer schedule deactivated."));
});
