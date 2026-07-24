import cron from "node-cron";
import { Subscription } from "../models/subscription.models.js";
import { User } from "../models/user.models.js";
import { Ptbill } from "../models/ptbill.models.js";

console.log("upcoming to active cron loaded");


const activateUpcomingSubscriptions = async () => {
  const now = new Date();
  
  try {
    const result = await Subscription.updateMany(
      {
        subscription: {
          $elemMatch: {
            startDate: { $lte: now },
            status: "upcoming",
          },
        },
      },
      {
        $set: {
          "subscription.$[elem].status": "active",
        },
      },
      {
        arrayFilters: [
          {
            "elem.startDate": { $lte: now },
            "elem.status": "upcoming",
          },
        ],
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[CRON] ✅ Activated ${result.modifiedCount} upcoming gym subscription(s)`);
      
      // Activate users who got their subscription activated
      const subs = await Subscription.find({
        subscription: {
          $elemMatch: {
            startDate: { $lte: now },
            status: "active",
          },
        },
      }).select('user');
      
      const userIds = subs.map(s => s.user);
      await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { isActive: true } }
      );
    } else {
      console.log("[CRON] No upcoming gym subscriptions to activate");
    }
  } catch (error) {
    console.error("[CRON] ❌ Failed to activate gym subscriptions:", error);
  }
};

// Activate upcoming PT subscriptions
const activateUpcomingPT = async () => {
  const now = new Date();
  
  try {
    const result = await Ptbill.updateMany(
      {
        subscription: {
          $elemMatch: {
            startDate: { $lte: now },
            status: "upcoming",
          },
        },
      },
      {
        $set: {
          "subscription.$[elem].status": "active",
        },
      },
      {
        arrayFilters: [
          {
            "elem.startDate": { $lte: now },
            "elem.status": "upcoming",
          },
        ],
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[CRON] ✅ Activated ${result.modifiedCount} upcoming PT subscription(s)`);
    } else {
      console.log("[CRON] No upcoming PT subscriptions to activate");
    }
  } catch (error) {
    console.error("[CRON] ❌ Failed to activate PT subscriptions:", error);
  }
};

// Schedule cron job - Daily at 12:10 AM IST
export const upcomingToActiveJob = () => {
  cron.schedule("10 0 * * *", async () => {
    console.log("\n[CRON] ⏰ Upcoming to Active job started at", new Date().toISOString());
    
    await activateUpcomingSubscriptions();
    await activateUpcomingPT();
    
    console.log("[CRON] ✅ Upcoming to Active job completed\n");
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  console.log("✅ Upcoming to Active cron scheduled (Daily at 12:10 AM IST)");
};

// Start the job
upcomingToActiveJob();