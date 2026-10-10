import { DateTime } from "luxon";
import { ApiError } from "../utils/ApiError.js";

const TIMEZONE = "Asia/Kolkata";
const MIN_SCAN_GAP_SECONDS = 30;

const buildTime = (date, time) =>
  DateTime.fromFormat(`${date} ${time}`, "yyyy-MM-dd HH:mm", {
    zone: TIMEZONE,
  });

const isInsideWindow = (now, start, end) =>
  now.toMillis() >= start.toMillis() &&
  now.toMillis() <= end.toMillis();

const getEventTime = (event) =>
  DateTime.fromJSDate(new Date(event.createdAt)).setZone(TIMEZONE);

const findBreakFromBreakOut = ({
  breakOutEvent,
  schedule,
  date,
}) => {
  if (!breakOutEvent) return null;

  const breakOutTime = getEventTime(breakOutEvent);

  return (schedule.breaks || []).find((slot) => {
    const start = buildTime(date, slot.startTime);
    const end = buildTime(date, slot.endTime);

    return (
      breakOutTime.toMillis() >= start.toMillis() &&
      breakOutTime.toMillis() < end.toMillis()
    );
  }) ?? null;
};

const wasBreakAlreadyUsed = ({
  scheduledBreak,
  todayEvents,
  date,
}) => {
  const start = buildTime(date, scheduledBreak.startTime);
  const end = buildTime(date, scheduledBreak.endTime);

  return todayEvents.some((event) => {
    if (event.type !== "break out") return false;

    const eventTime = getEventTime(event);

    return (
      eventTime.toMillis() >= start.toMillis() &&
      eventTime.toMillis() < end.toMillis()
    );
  });
};

const getCurrentScheduledBreak = ({
  schedule,
  currentTime,
  todayEvents,
  date,
}) => {
  for (const scheduledBreak of schedule.breaks || []) {
    const start = buildTime(
      date,
      scheduledBreak.startTime
    );

    const end = buildTime(
      date,
      scheduledBreak.endTime
    );

    // Break-out is allowed throughout the scheduled break.
    const insideBreak =
      currentTime.toMillis() >= start.toMillis() &&
      currentTime.toMillis() < end.toMillis();

    if (!insideBreak) continue;

    if (
      wasBreakAlreadyUsed({
        scheduledBreak,
        todayEvents,
        date,
      })
    ) {
      continue;
    }

    return scheduledBreak;
  }

  return null;
};


const isCheckoutTime = ({
  schedule,
  currentTime,
  date,
}) => {
  const shiftEnd = buildTime(
    date,
    schedule.shiftEnd
  );

  const grace =
    schedule.gracePeriodMinutes ?? 0;

  const windowStart = shiftEnd.minus({
    minutes: grace,
  });

  const windowEnd = shiftEnd.plus({
    minutes: grace,
  });

  return isInsideWindow(
    currentTime,
    windowStart,
    windowEnd
  );
};

const validateScanGap = ({
  lastEvent,
  currentTime,
}) => {
  if (!lastEvent) return;

  const lastEventTime =
    getEventTime(lastEvent);

  const seconds = currentTime.diff(
    lastEventTime,
    "seconds"
  ).seconds;

  if (seconds < MIN_SCAN_GAP_SECONDS) {
    throw new ApiError(
      429,
      "Attendance was just recorded. Please wait before scanning again."
    );
  }
};

const handleFirstCheckIn = ({
  schedule,
  currentTime,
  date,
}) => {
  const shiftStart = buildTime(
    date,
    schedule.shiftStart
  );

  const shiftEnd = buildTime(
    date,
    schedule.shiftEnd
  );

  const grace =
    schedule.gracePeriodMinutes ?? 0;

  const earliestCheckIn =
    shiftStart.minus({
      minutes: grace,
    });

  const latestPossibleCheckIn =
    shiftEnd.plus({
      minutes: grace,
    });

  if (
    currentTime.toMillis() <
    earliestCheckIn.toMillis()
  ) {
    throw new ApiError(
      400,
      "Your shift has not started yet."
    );
  }

  if (
    currentTime.toMillis() >
    latestPossibleCheckIn.toMillis()
  ) {
    throw new ApiError(
      400,
      "Today's shift has already ended."
    );
  }

  const graceEnd =
    shiftStart.plus({
      minutes: grace,
    });

  const lateByMinutes =
    currentTime.toMillis() >
    graceEnd.toMillis()
      ? Math.floor(
          currentTime.diff(
            graceEnd,
            "minutes"
          ).minutes
        )
      : 0;

  return {
    type: "check in",
    reason: "SHIFT_START",
    lateByMinutes,
    date,
  };
};

export const determineAttendanceType = ({
  schedule,
  todayEvents,
  now = new Date(),
}) => {
  if (!schedule) {
    throw new ApiError(
      404,
      "No active schedule found."
    );
  }

  const currentTime =
    DateTime.fromJSDate(now).setZone(
      TIMEZONE
    );

  const date =
    currentTime.toFormat("yyyy-MM-dd");

  const currentDay =
    currentTime.weekday % 7;

  if (
    schedule.daysOfWeek?.length &&
    !schedule.daysOfWeek.includes(
      currentDay
    )
  ) {
    throw new ApiError(
      400,
      "You are not scheduled to work today."
    );
  }

  const lastEvent =
    todayEvents.length > 0
      ? todayEvents[
          todayEvents.length - 1
        ]
      : null;

  validateScanGap({
    lastEvent,
    currentTime,
  });

  if (!lastEvent) {
    return handleFirstCheckIn({
      schedule,
      currentTime,
      date,
    });
  }

  if (lastEvent.type === "check out") {
    throw new ApiError(
      400,
      "Today's shift is already completed."
    );
  }

  if (lastEvent.type === "excess out") {
    const outTime =
      getEventTime(lastEvent);

    const excessMinutes =
      Math.max(
        0,
        Math.floor(
          currentTime.diff(
            outTime,
            "minutes"
          ).minutes
        )
      );

    return {
      type: "excess in",
      reason: "RETURN_FROM_EXCESS_OUT",
      excessMinutes,
      date,
    };
  }

if (lastEvent.type === "break out") {
  const matchedBreak = findBreakFromBreakOut({
    breakOutEvent: lastEvent,
    schedule,
    date,
  });

  if (!matchedBreak) {
    throw new ApiError(
      409,
      "Cannot identify the scheduled break. Please contact an admin."
    );
  }

  const breakEnd = buildTime(
    date,
    matchedBreak.endTime
  );

  const graceMinutes =
    matchedBreak.gracePeriodMinutes ?? 0;

  const allowedReturnUntil = breakEnd.plus({
    minutes: graceMinutes,
  });

  const excessMinutes = Math.max(
    0,
    Math.floor(
      currentTime.diff(
        allowedReturnUntil,
        "minutes"
      ).minutes
    )
  );

  return {
    type: "break in",

    reason:
      excessMinutes > 0
        ? "LATE_RETURN_FROM_BREAK"
        : "RETURN_FROM_SCHEDULED_BREAK",

    breakName: matchedBreak.name,
    excessMinutes,
    lateByMinutes: 0,
    date,
  };
}


  const trainerIsInside = [
    "check in",
    "break in",
    "excess in",
  ].includes(lastEvent.type);

  if (!trainerIsInside) {
    throw new ApiError(
      400,
      "Invalid attendance state."
    );
  }

  if (
    isCheckoutTime({
      schedule,
      currentTime,
      date,
    })
  ) {
    return {
      type: "check out",
      reason: "SHIFT_END",
      date,
    };
  }

  const currentBreak =
    getCurrentScheduledBreak({
      schedule,
      currentTime,
      todayEvents,
      date,
    });

  if (currentBreak) {
    return {
      type: "break out",
      reason: "SCHEDULED_BREAK",
      breakName: currentBreak.name,
      date,
    };
  }

  return {
    type: "excess out",
    reason: "UNSCHEDULED_EXIT",
    date,
  };
};