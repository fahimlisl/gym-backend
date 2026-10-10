
import mongoose from "mongoose";
import { DateTime } from "luxon";

import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

import { Trainer } from "../models/trainer.models.js";
import { TrainerAttendance } from "../models/trainerAttendance.models.js";
import { StaffSchedule } from "../models/schedule.staff.models.js";

const ZONE = "Asia/Kolkata";

const getDate = (value) => {
  const date = value || DateTime.now().setZone(ZONE).toISODate();

  const parsed = DateTime.fromISO(date, { zone: ZONE });

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !parsed.isValid ||
    parsed.toISODate() !== date
  ) {
    throw new ApiError(400, "Invalid attendance date.");
  }

  return date;
};

const minutesBetween = (start, end) =>
  Math.max(
    0,
    Math.round(
      (new Date(end).getTime() -
        new Date(start).getTime()) / 60000
    )
  );

  // const buildDailyTimeline = (events, schedule, date) => {
//   const timeline = events.map((event) => ({
//     id: String(event._id),
//     type: event.type,
//     time: event.createdAt,
//     displayTime: DateTime.fromJSDate(event.createdAt)
//       .setZone(ZONE)
//       .toFormat("hh:mm a"),
//     source: event.source,
//     lateMinutes: 0,
//     durationMinutes: null,
//     note: "",
//   }));

//   let excessOutIndex = null;
//   let breakOutIndex = null;
//   let totalExcessMinutes = 0;

//   const firstCheckInIndex = timeline.findIndex(
//     (event) => event.type === "check in"
//   );

//   if (
//     firstCheckInIndex >= 0 &&
//     schedule?.shiftStart
//   ) {
//     const scheduledStart = DateTime.fromFormat(
//       `${date} ${schedule.shiftStart}`,
//       "yyyy-MM-dd HH:mm",
//       { zone: ZONE }
//     );

//     if (scheduledStart.isValid) {
//       const actual = DateTime.fromJSDate(
//         events[firstCheckInIndex].createdAt
//       ).setZone(ZONE);

//       const lateMinutes = Math.max(
//         0,
//         Math.floor(
//           actual.diff(scheduledStart, "minutes").minutes
//         )
//       );

//       timeline[firstCheckInIndex].lateMinutes =
//         lateMinutes;

//       timeline[firstCheckInIndex].note =
//         lateMinutes > 0
//           ? `${lateMinutes} minutes late`
//           : "On time";
//     }
//   }

//   for (let i = 0; i < timeline.length; i++) {
//     const event = timeline[i];

//     if (event.type === "excess out") {
//       excessOutIndex = i;
//       event.note = "Outside scheduled break";
//     }

//     if (
//       event.type === "excess in" &&
//       excessOutIndex !== null
//     ) {
//       const duration = minutesBetween(
//         timeline[excessOutIndex].time,
//         event.time
//       );

//       event.durationMinutes = duration;
//       event.note = `Excess time away: ${duration} minutes`;

//       timeline[excessOutIndex].durationMinutes =
//         duration;
//       timeline[excessOutIndex].note =
//         `Returned after ${duration} minutes`;

//       totalExcessMinutes += duration;
//       excessOutIndex = null;
//     }

//     if (event.type === "break out") {
//       breakOutIndex = i;
//       event.note = "Scheduled break started";
//     }

//     if (
//       event.type === "break in" &&
//       breakOutIndex !== null
//     ) {
//       const duration = minutesBetween(
//         timeline[breakOutIndex].time,
//         event.time
//       );

//       event.durationMinutes = duration;
//       event.note = `Break duration: ${duration} minutes`;

//       timeline[breakOutIndex].durationMinutes =
//         duration;

//       breakOutIndex = null;
//     }
//   }

//   return {
//     timeline,
//     summary: {
//       totalScans: timeline.length,
//       firstCheckIn:
//         timeline.find((e) => e.type === "check in")
//           ?.displayTime ?? null,
//       lastCheckOut:
//         [...timeline]
//           .reverse()
//           .find((e) => e.type === "check out")
//           ?.displayTime ?? null,
//       lateMinutes:
//         firstCheckInIndex >= 0
//           ? timeline[firstCheckInIndex].lateMinutes
//           : null,
//       totalExcessMinutes,
//       excessCurrentlyOpen: excessOutIndex !== null,
//     },
//   };
// };

// All trainers for a selected date



const buildDailyTimeline = (events, schedule, date) => {
  const timeline = events.map((event) => ({
    id: String(event._id),
    type: event.type,
    time: event.createdAt,

    displayTime: DateTime.fromJSDate(event.createdAt)
      .setZone(ZONE)
      .toFormat("hh:mm a"),

    source: event.source,
    lateMinutes: 0,
    excessMinutes: 0,
    durationMinutes: null,
    note: "",
  }));

  const eventTime = (event) =>
    DateTime.fromJSDate(new Date(event.createdAt))
      .setZone(ZONE);

  const scheduleTime = (hhmm) =>
    DateTime.fromFormat(
      `${date} ${hhmm}`,
      "yyyy-MM-dd HH:mm",
      { zone: ZONE }
    );

  const getBreakForExit = (index) => {
    const recorded = events[index];

    // Prefer the schedule attached to the record.
    const eventSchedule =
      recorded?.schedule?.breaks
        ? recorded.schedule
        : schedule;

    const exitedAt = eventTime(recorded);

    return (eventSchedule?.breaks || []).find((slot) => {
      const start = scheduleTime(slot.startTime);
      const end = scheduleTime(slot.endTime);

      return (
        exitedAt.toMillis() >= start.toMillis() &&
        exitedAt.toMillis() < end.toMillis()
      );
    }) ?? null;
  };

  let excessOutIndex = null;
  let breakOutIndex = null;
  let totalExcessMinutes = 0;

  const firstCheckInIndex = timeline.findIndex(
    (event) => event.type === "check in"
  );

  if (
    firstCheckInIndex >= 0 &&
    schedule?.shiftStart
  ) {
    const expectedStart = scheduleTime(
      schedule.shiftStart
    );

    const actualStart = eventTime(
      events[firstCheckInIndex]
    );

    const late = Math.max(
      0,
      Math.floor(
        actualStart.diff(
          expectedStart,
          "minutes"
        ).minutes
      )
    );

    timeline[firstCheckInIndex].lateMinutes = late;
    timeline[firstCheckInIndex].note =
      late > 0 ? `${late} minutes late` : "On time";
  }

  for (let i = 0; i < timeline.length; i++) {
    const event = timeline[i];

    if (event.type === "excess out") {
      excessOutIndex = i;
      event.note = "Unscheduled exit";
      continue;
    }

    if (
      event.type === "excess in" &&
      excessOutIndex !== null
    ) {
      const duration = minutesBetween(
        timeline[excessOutIndex].time,
        event.time
      );

      event.durationMinutes = duration;
      event.excessMinutes = duration;
      event.note = `Returned after ${duration} minutes away`;

      timeline[excessOutIndex].durationMinutes =
        duration;

      totalExcessMinutes += duration;
      excessOutIndex = null;
      continue;
    }

    if (event.type === "break out") {
      breakOutIndex = i;
      event.note = "Scheduled break started";
      continue;
    }

    if (
      event.type === "break in" &&
      breakOutIndex !== null
    ) {
      const duration = minutesBetween(
        timeline[breakOutIndex].time,
        event.time
      );

      const scheduledBreak = getBreakForExit(
        breakOutIndex
      );

      let extraMinutes = 0;

      if (scheduledBreak) {
        const scheduledEnd = scheduleTime(
          scheduledBreak.endTime
        );

        const grace =
          scheduledBreak.gracePeriodMinutes ?? 0;

        const permittedReturn = scheduledEnd.plus({
          minutes: grace,
        });

        const actualReturn = eventTime(events[i]);

        extraMinutes = Math.max(
          0,
          Math.floor(
            actualReturn.diff(
              permittedReturn,
              "minutes"
            ).minutes
          )
        );

        event.breakName =
          scheduledBreak.name || "Break";

        event.scheduledBreakEnd =
          scheduledEnd.toISO();

        event.graceMinutes = grace;
      }

      event.durationMinutes = duration;
      event.excessMinutes = extraMinutes;

      event.note =
        extraMinutes > 0
          ? `Break return: ${extraMinutes} minutes beyond grace`
          : `Returned within break allowance (${duration} minutes away)`;

      timeline[breakOutIndex].durationMinutes =
        duration;

      timeline[breakOutIndex].note =
        `Break duration: ${duration} minutes`;

      totalExcessMinutes += extraMinutes;
      breakOutIndex = null;
    }
  }

  return {
    timeline,

    summary: {
      totalScans: timeline.length,

      firstCheckIn:
        timeline.find((e) => e.type === "check in")
          ?.displayTime ?? null,

      lastCheckOut:
        [...timeline]
          .reverse()
          .find((e) => e.type === "check out")
          ?.displayTime ?? null,

      lateMinutes:
        firstCheckInIndex >= 0
          ? timeline[firstCheckInIndex].lateMinutes
          : null,

      totalExcessMinutes,

      excessCurrentlyOpen:
        excessOutIndex !== null,

      breakCurrentlyOpen:
        breakOutIndex !== null,
    },
  };
};






export const getAllTrainerAttendanceByDate =
  asyncHandler(async (req, res) => {
    const date = getDate(req.query.date);

    const dayOfWeek =
      DateTime.fromISO(date, { zone: ZONE }).weekday % 7;

    const [trainers, events, schedules] =
      await Promise.all([
        Trainer.find()
          .select("fullName email")
          .sort({ fullName: 1 })
          .lean(),

        TrainerAttendance.find({ date })
          .populate(
            "schedule",
            "shiftStart shiftEnd breaks gracePeriodMinutes"
          )
          .sort({ createdAt: 1, _id: 1 })
          .lean(),

        StaffSchedule.find({
          isActive: true,
          daysOfWeek: dayOfWeek,
        })
          .sort({ updatedAt: -1 })
          .lean(),
      ]);

    const eventsByTrainer = new Map();
    const schedulesByTrainer = new Map();

    for (const schedule of schedules) {
      const id = String(schedule.trainer);

      if (!schedulesByTrainer.has(id)) {
        schedulesByTrainer.set(id, schedule);
      }
    }

    for (const event of events) {
      const id = String(event.trainer);

      if (!eventsByTrainer.has(id)) {
        eventsByTrainer.set(id, []);
      }

      eventsByTrainer.get(id).push(event);
    }

    const today = DateTime.now()
      .setZone(ZONE)
      .toISODate();

    const data = trainers.map((trainer) => {
      const id = String(trainer._id);
      const trainerEvents = eventsByTrainer.get(id) || [];

      // Prefer the schedule attached to an actual
      // attendance record if it exists.
      const schedule =
        trainerEvents.find((e) => e.schedule?.shiftStart)
          ?.schedule ??
        schedulesByTrainer.get(id) ??
        null;

      const { summary } = buildDailyTimeline(
        trainerEvents,
        schedule,
        date
      );

      let status = "present";

      if (trainerEvents.length === 0) {
        status = !schedule
          ? "no-schedule"
          : date > today
            ? "upcoming"
            : date === today
              ? "not-checked-in"
              : "absent";
      }

      return {
        trainer: {
          _id: trainer._id,
          fullName: trainer.fullName,
          email: trainer.email,
        },
        date,
        status,
        schedule: schedule
          ? {
              shiftStart: schedule.shiftStart,
              shiftEnd: schedule.shiftEnd,
            }
          : null,
        summary,
      };
    });

    return res.status(200).json(
      new ApiResponse(
        200,
        { date, trainers: data },
        "Trainer attendance fetched successfully."
      )
    );
  });

// One trainer's complete timeline for a selected date
export const getTrainerAttendanceByDate =
  asyncHandler(async (req, res) => {
    const { trainerId } = req.params;
    const date = getDate(req.query.date);

    if (!mongoose.isValidObjectId(trainerId)) {
      throw new ApiError(400, "Invalid trainer ID.");
    }

    const trainer = await Trainer.findById(trainerId)
      .select("fullName email")
      .lean();

    if (!trainer) {
      throw new ApiError(404, "Trainer not found.");
    }

    const events = await TrainerAttendance.find({
      trainer: trainerId,
      date,
    })
      .populate(
        "schedule",
        "shiftStart shiftEnd breaks gracePeriodMinutes"
      )
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    const dayOfWeek =
      DateTime.fromISO(date, { zone: ZONE }).weekday % 7;

    const schedule =
      events.find((e) => e.schedule?.shiftStart)
        ?.schedule ??
      (await StaffSchedule.findOne({
        trainer: trainerId,
        isActive: true,
        daysOfWeek: dayOfWeek,
      }).lean());

    const result = buildDailyTimeline(
      events,
      schedule,
      date
    );

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          trainer,
          date,
          schedule,
          ...result,
        },
        "Trainer daily attendance fetched successfully."
      )
    );
  });
