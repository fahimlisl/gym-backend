
import redis from "../utils/redis.js";
import { getNext1230AMIST } from "../utils/aiCacheExpiry.js";

import { User } from "../models/user.models.js";
import { Subscription } from "../models/subscription.models.js";
import { Ptbill } from "../models/ptbill.models.js";

const SNAPSHOT_VERSION = 2;

const toTime = (value) => {
  if (!value) return null;

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
};

const getEffectiveStatus = (period, type, now) => {
  const start = toTime(period.startDate);
  const end = toTime(period.endDate);

  if (type === "gym" && period.status === "cancelled") {
    return "cancelled";
  }

  if (end !== null && now >= end) {
    return "expired";
  }

  if (start !== null && now < start) {
    return "upcoming";
  }

  if (type === "pt" && period.status === "paused") {
    return "paused";
  }

  if (
    type === "gym" &&
    period.paymentStatus !== "paid"
  ) {
    return "payment_pending";
  }

  if (type === "pt" && end === null) {
    return period.status === "expired"
      ? "expired"
      : "active";
  }

  return "active";
};

const buildSubscriptionSummary = (periods, type, now) => {
  const records = periods.map((period) => ({
    ...period,
    effectiveStatus: getEffectiveStatus(
      period,
      type,
      now
    ),
  }));

  const byLatestStart = [...records].sort(
    (a, b) =>
      (toTime(b.startDate) ?? 0) -
      (toTime(a.startDate) ?? 0)
  );

  const upcoming = records
    .filter(
      (record) =>
        record.effectiveStatus === "upcoming"
    )
    .sort(
      (a, b) =>
        (toTime(a.startDate) ?? Infinity) -
        (toTime(b.startDate) ?? Infinity)
    );

  const expired = records
    .filter(
      (record) =>
        record.effectiveStatus === "expired"
    )
    .sort(
      (a, b) =>
        (toTime(b.endDate) ?? 0) -
        (toTime(a.endDate) ?? 0)
    );

  return {
    current:
      byLatestStart.find(
        (record) =>
          record.effectiveStatus === "active"
      ) || null,

    paused:
      byLatestStart.find(
        (record) =>
          record.effectiveStatus === "paused"
      ) || null,

    latest: byLatestStart[0] || null,

    nextUpcoming: upcoming[0] || null,

    upcoming,

    lastExpired: expired[0] || null,

    totalPeriods: records.length,
  };
};

const createAiView = (cachedData) => {
  const now = Date.now();

  return {
    version: SNAPSHOT_VERSION,

    member: cachedData.member,

    gymSubscription: buildSubscriptionSummary(
      cachedData.gymPeriods,
      "gym",
      now
    ),

    personalTraining: buildSubscriptionSummary(
      cachedData.ptPeriods,
      "pt",
      now
    ),

    cachedAt: cachedData.cachedAt,
    evaluatedAt: new Date(now).toISOString(),
  };
};

export const getMemberAiSnapshot = async (memberId) => {
  const key = `alphagym:ai:member:${memberId}`;

  try {
    const cached = await redis.get(key);

    if (cached) {
      const cachedData = JSON.parse(cached);

      if (
        cachedData.version === SNAPSHOT_VERSION &&
        Array.isArray(cachedData.gymPeriods) &&
        Array.isArray(cachedData.ptPeriods)
      ) {
        return {
          source: "redis",
          snapshot: createAiView(cachedData),
        };
      }
    }
  } catch (error) {
    console.error(
      "Redis read failed:",
      error.message
    );
  }

  const member = await User.findById(memberId)
    .select(
      "username email phoneNumber isActive subscription personalTraning"
    )
    .lean();

  if (!member || member.isActive === false) {
    const error = new Error(
      "Member not found or inactive"
    );
    error.statusCode = 403;
    throw error;
  }
  const gymBill = member.subscription
    ? await Subscription.findOne({
        _id: member.subscription,
        user: member._id,
      })
        .select(
          "subscription.plan subscription.startDate subscription.endDate subscription.status subscription.paymentStatus subscription.createdAt"
        )
        .lean()
    : null;

  const ptBill = member.personalTraning
    ? await Ptbill.findOne({
        _id: member.personalTraning,
        user: member._id,
      })
        .select(
          "subscription.plan subscription.startDate subscription.endDate subscription.status subscription.trainer subscription.createdAt"
        )
        .lean()
    : null;

  const gymPeriods = (gymBill?.subscription || []).map(
    (item) => ({
      id: item._id ? String(item._id) : null,
      plan: item.plan,
      startDate: item.startDate,
      endDate: item.endDate,
      status: item.status,
      paymentStatus: item.paymentStatus,
      createdAt: item.createdAt,
    })
  );

  const ptPeriods = (ptBill?.subscription || []).map(
    (item) => ({
      id: String(item._id),
      plan: item.plan,
      startDate: item.startDate,
      endDate: item.endDate || null,
      status: item.status,
      trainerId: item.trainer
        ? String(item.trainer)
        : null,
      createdAt: item.createdAt,
    })
  );

  const cachedData = {
    version: SNAPSHOT_VERSION,

    member: {
      id: String(member._id),
      name: member.username || null,
      email: member.email || null,
      phoneNumber: member.phoneNumber
        ? String(member.phoneNumber)
        : null,
      isActive: member.isActive,
    },

    gymPeriods,
    ptPeriods,

    cachedAt: new Date().toISOString(),
  };

  try {
    await redis.set(
      key,
      JSON.stringify(cachedData),
      "EXAT",
      getNext1230AMIST()
    );
  } catch (error) {
    console.error(
      "Redis write failed:",
      error.message
    );
  }

  return {
    source: "mongodb",
    snapshot: createAiView(cachedData),
  };
};
