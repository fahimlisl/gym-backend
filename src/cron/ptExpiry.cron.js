import cron from "node-cron";
import { Ptbill } from "../models/ptbill.models.js";
import { Trainer } from "../models/trainer.models.js";
import axios from "axios";
import { sendWhatsAppMessage } from "../service/sendWp.js";

console.log("PT expiry cron loaded");

const expirePTSubscriptions = async () => {
  const now = new Date();
  
  try {
    const expiredPTs = await Ptbill.find({
      subscription: {
        $elemMatch: {
          endDate: { $lt: now },
          status: "active",
        },
      },
    }).populate('user', 'username email phoneNumber');

    if (expiredPTs.length === 0) {
      console.log("[CRON-PT] No PT subscriptions to expire");
      return { success: true, expired: 0, emailsSent: 0 };
    }

    console.log(`[CRON-PT] Found ${expiredPTs.length} PT subscription(s) with expired entries`);

    const result = await Ptbill.updateMany(
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

    console.log(`[CRON-PT] 💀 Expired ${result.modifiedCount} PT subscription(s)`);

    let emailsSent = 0;
    let emailsFailed = 0;

    for (const ptbill of expiredPTs) {
      const user = ptbill.user;
      if (!user) continue;

      const expiredEntry = ptbill.subscription.find(
        s => s.endDate < now && s.status === "active"
      );

      if (expiredEntry && user.email) {
        try {
          const trainer = await Trainer.findById(expiredEntry.trainer);
          
          await axios.post(process.env.N8N_WEBHOOK_URL, {
            eventType: "pt_expired",
            memberName: user.username,
            email: user.email,
            phoneNumber: user.phoneNumber,
            plan: expiredEntry.plan,
            trainerName: trainer?.name || "Your Personal Trainer",
            expiredDate: expiredEntry.endDate.toISOString(),
            expiryNoticeDate: new Date().toISOString()
          });
          emailsSent++;
          console.log(`[CRON-PT] 📧 PT expiry email sent to ${user.email}`);
        } catch (error) {
          emailsFailed++;
          console.error(`[CRON-PT] ❌ Failed to send email to ${user.email}:`, error.message);
        }

        if (user.phoneNumber) {
          try {
            const trainer = await Trainer.findById(expiredEntry.trainer);
            const plan = expiredEntry.plan || "personal training";
            const expiryDate = new Date(expiredEntry.endDate).toLocaleDateString("en-IN", {
              day: "numeric", month: "long", year: "numeric",
            });

            const msg =
              `🔔 Dear ${user.username},\n\n` +
              `Your personal training subscription (${plan} plan) has expired on ${expiryDate}. ⏰\n\n` +
              `Don’t let your hard work stop! Renew your PT package to keep receiving:\n` +
              `🔥 Customised workout plans\n` +
              `🔥 One‑on‑one attention from ${trainer?.fullName || "your trainer"}\n` +
              `🔥 Faster progress toward your goals\n\n` +
              `Get in touch with us to renew and continue smashing your goals! 🏆\n\n` +
              `– THE ALPHA (A) FITNESS & EDUCATION 💚`;

            await sendWhatsAppMessage(user.phoneNumber, msg);
            console.log(`[CRON-PT] 📲 WhatsApp expiry sent to ${user.phoneNumber}`);
          } catch (wpError) {
            console.error(`[CRON-PT] ❌ Failed to send WhatsApp to ${user.phoneNumber}:`, wpError.message);
          }
        }
      }
    }

    const summary = {
      success: true,
      expired: result.modifiedCount,
      emailsSent,
      emailsFailed,
      timestamp: new Date().toISOString()
    };

    console.log(`[CRON-PT] Summary:`, summary);
    return summary;

  } catch (error) {
    console.error("[CRON-PT] ❌ PT expiry failed:", error);
    return { 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};


export const testPTExpiry = async () => {
  console.log("\n🧪 [TEST-PT] Running manual PT expiry test...");
  console.log("🕐 Current time:", new Date().toISOString());
  
  const result = await expirePTSubscriptions();
  
  console.log("\n🧪 [TEST-PT] Test completed:", result);
  return result;
};



export const ptExpiryJob = () => {
  cron.schedule("10 0 * * *", async () => {
    console.log("\n[CRON-PT] ⏰ PT expiry job started at", new Date().toISOString());
    await expirePTSubscriptions();
    console.log("[CRON-PT] ✅ PT expiry job completed\n");
  });

  console.log("PT expiry cron scheduled (Daily at 12:10 AM)");
};

ptExpiryJob();