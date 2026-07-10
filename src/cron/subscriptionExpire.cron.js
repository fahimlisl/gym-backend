import cron from "node-cron";
import { Subscription } from "../models/subscription.models.js";
import { User } from "../models/user.models.js";
import axios from "axios";
import { sendWhatsAppMessage } from "../service/sendWp.js";

console.log("subscription expiry cron loaded");

const expireSubscriptions = async () => {
  const now = new Date();
  
  try {
    const expiredSubs = await Subscription.find({
      subscription: {
        $elemMatch: {
          endDate: { $lt: now },
          status: "active",
        },
      },
    }).populate('user', 'username email phoneNumber');

    if (expiredSubs.length === 0) {
      console.log("[CRON] No subscriptions to expire");
      return { success: true, expired: 0, emailsSent: 0, usersDeactivated: 0 };
    }

    console.log(`[CRON] Found ${expiredSubs.length} subscription(s) with expired entries`);

    const result = await Subscription.updateMany(
      {
        subscription: {
          $elemMatch: {
            endDate: { $lt: now },
            status: "active",
          },
        },
      },
      {
        $set: {
          "subscription.$[elem].status": "expired",
        },
      },
      {
        arrayFilters: [
          {
            "elem.endDate": { $lt: now },
            "elem.status": "active",
          },
        ],
      }
    );

    console.log(`[CRON] 💀 Expired ${result.modifiedCount} subscription(s)`);

    // Deactivate users with expired subscriptions
    const userIdsToDeactivate = expiredSubs.map(sub => sub.user?._id).filter(Boolean);
    
    const userUpdateResult = await User.updateMany(
      { _id: { $in: userIdsToDeactivate } },
      { $set: { isActive: false } }
    );

    console.log(`[CRON] 🔒 Deactivated ${userUpdateResult.modifiedCount} user(s)`);

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const sub of expiredSubs) {
      const user = sub.user;
      if (!user) continue;

      const expiredEntry = sub.subscription.find(
        s => s.endDate < now && s.status === "active"
      );

      if (expiredEntry && user.email) {
        try {
          await axios.post(process.env.N8N_WEBHOOK_URL, {
            eventType: "subscription_expired",
            memberName: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            plan: expiredEntry.plan,
            expiredDate: expiredEntry.endDate.toISOString(),
            expiryNoticeDate: new Date().toISOString()
          });
          emailsSent++;
          console.log(`[CRON] 📧 Expiry email sent to ${user.email}`);
        } catch (error) {
          emailsFailed++;
          console.error(`[CRON] ❌ Failed to send email to ${user.email}:`, error.message);
        }

        if (user.phoneNumber) {
          try {
            const plan = expiredEntry.plan || "membership";
            const expiryDate = new Date(expiredEntry.endDate).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            });

            const msg =
              `🔔 Dear ${user.username},\n\n` +
              `Your gym membership (${plan} plan) has expired on ${expiryDate}. 💔\n\n` +
              `We’d love to see you back! Renew today to continue accessing.\n` +
              `Visit the front desk or call us to renew your membership and keep your fitness journey going strong. 💪😊\n\n` +
              `– THE ALPHA (A) FITNESS & EDUCATION 💚`;

            await sendWhatsAppMessage(user.phoneNumber, msg);
            console.log(`[CRON] 📲 WhatsApp expiry sent to ${user.phoneNumber}`);
          } catch (wpError) {
            console.error(`[CRON] ❌ Failed to send WhatsApp to ${user.phoneNumber}:`, wpError.message);
          }
        }
      }
    }

    const summary = {
      success: true,
      expired: result.modifiedCount,
      usersDeactivated: userUpdateResult.modifiedCount,
      emailsSent,
      emailsFailed,
      timestamp: new Date().toISOString()
    };

    console.log(`[CRON] Summary:`, summary);
    return summary;

  } catch (error) {
    console.error("[CRON] ❌ Subscription expiry failed:", error);
    return { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

export const testSubscriptionExpiry = async () => {
  console.log("\n🧪 [TEST] Running manual subscription expiry test...");
  console.log("🕐 Current time:", new Date().toISOString());
  
  const result = await expireSubscriptions();
  
  console.log("\n🧪 [TEST] Test completed:", result);
  return result;
};

export const subscriptionExpiryJob = () => {
  const job = cron.schedule("20 0 * * *", async () => {
    console.log("\n[CRON] ⏰ Subscription expiry job started at", new Date().toISOString());
    await expireSubscriptions();
    console.log("[CRON] ✅ Subscription expiry job completed\n");
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log("✅ Subscription expiry cron scheduled (Daily at 12:20 AM IST)");
};

subscriptionExpiryJob();