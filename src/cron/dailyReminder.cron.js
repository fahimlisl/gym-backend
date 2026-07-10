import cron from "node-cron";
import { User } from "../models/user.models.js";
import { Subscription } from "../models/subscription.models.js";
import { Ptbill } from "../models/ptbill.models.js";
import { sendWhatsAppMessage } from "../service/sendWp.js";

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

let isRunning = false; 

const buildMessage = (user, membershipPlan, ptPlan, membershipExpiryDate, ptExpiryDate) => {
  const name = user.username || "Member";
  const lines = [];

  lines.push(`🔔 Good morning, ${name}!`);

  if (membershipPlan && ptPlan) {
    lines.push(`Both your gym membership (${membershipPlan}) and personal training (${ptPlan}) have expired.`);
    if (membershipExpiryDate) lines.push(`📅 Membership expired: ${membershipExpiryDate}`);
    if (ptExpiryDate) lines.push(`📅 PT expired: ${ptExpiryDate}`);
  } else if (membershipPlan) {
    lines.push(`Your gym membership (${membershipPlan}) has expired.`);
    if (membershipExpiryDate) lines.push(`📅 Expired on: ${membershipExpiryDate}`);
  } else if (ptPlan) {
    lines.push(`Your personal training subscription (${ptPlan}) has expired.`);
    if (ptExpiryDate) lines.push(`📅 Expired on: ${ptExpiryDate}`);
  }

  lines.push(`\nDon't miss out — renew today to get back on track! 💪`);
  lines.push(`Contact us or visit the front desk.`);
  lines.push(`\n– THE ALPHA (A) FITNESS & EDUCATION 💚`);

  return lines.join("\n");
};

const sendDailyReminders = async () => {
  if (isRunning) {
    console.log("[REMINDER] Previous run still in progress – skipping this cycle.");
    return;
  }
  isRunning = true;

  console.log("[REMINDER] Starting daily expired‑member reminders...");
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  try {
    const expiredUsers = await User.find({ isActive: false })
      .select("_id username phoneNumber reminderSentAt")
      .lean();

    const results = { total: expiredUsers.length, sent: 0, skipped: 0, failed: 0 };

    for (const user of expiredUsers) {
      if (user.reminderSentAt && new Date(user.reminderSentAt) >= todayStart) {
        console.log(`[REMINDER] Already reminded ${user.username} today – skipping.`);
        results.skipped++;
        continue;
      }

      const sub = await Subscription.findOne({ user: user._id }).lean();
      const membershipExpiredEntry = sub?.subscription?.filter(s => s.status === "expired")?.[0] || null;
      const membershipActiveEntry = sub?.subscription?.some(s => s.status === "active");
      const hasMembershipExpired = membershipExpiredEntry && !membershipActiveEntry;

      const pt = await Ptbill.findOne({ user: user._id }).lean();
      const ptExpiredEntry = pt?.subscription?.filter(s => s.status === "expired")?.[0] || null;
      const ptActiveEntry = pt?.subscription?.some(s => s.status === "active");
      const hasPTExpired = ptExpiredEntry && !ptActiveEntry;

      if (!hasMembershipExpired && !hasPTExpired) {
        results.skipped++;
        continue;
      }

      const membershipPlan = membershipExpiredEntry?.plan || null;
      const ptPlan = ptExpiredEntry?.plan || null;
      const membershipExpiryDate = membershipExpiredEntry?.endDate
        ? new Date(membershipExpiredEntry.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : null;
      const ptExpiryDate = ptExpiredEntry?.endDate
        ? new Date(ptExpiredEntry.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
        : null;

      const msg = buildMessage(user, membershipPlan, ptPlan, membershipExpiryDate, ptExpiryDate);

      try {
        await sendWhatsAppMessage(user.phoneNumber, msg);
        await User.findByIdAndUpdate(user._id, { reminderSentAt: new Date() });
        results.sent++;
        console.log(`[REMINDER] Sent to ${user.username} (${user.phoneNumber})`);
      } catch (err) {
        results.failed++;
        console.error(`[REMINDER] Failed for ${user.username}:`, err.message);
      }

      await delay(15_000);
    }

    console.log(`[REMINDER] Done. Sent: ${results.sent}, Skipped: ${results.skipped}, Failed: ${results.failed}`);
    return results;
  } catch (error) {
    console.error("[REMINDER] Cron error:", error);
  } finally {
    isRunning = false;
  }
};

let cronJob = null;

export const dailyReminderJob = () => {
  if (cronJob) {
    console.log("[REMINDER] Cron already scheduled – skipping duplicate registration.");
    return;
  }

  cronJob = cron.schedule("0 10 * * *", async () => {
    console.log(`\n[REMINDER] ⏰ Daily reminder job started at ${new Date().toISOString()}`);
    await sendDailyReminders();
    console.log("[REMINDER] ✅ Daily reminder job completed\n");
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata",
  });

  console.log("✅ Daily reminder cron scheduled (Daily at 9:00 AM IST)");
};

dailyReminderJob();