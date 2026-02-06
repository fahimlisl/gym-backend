import cron from "node-cron";
import { Subscription } from "../models/subscription.models.js";

console.log(`cron has been successfully invoked for subscription!`)

export const subscriptionExpiryJob = () => {
  // Runs every day at 12:05 AM
  cron.schedule("5 0 * * *", async () => {
    try {
      const now = new Date();

      const result = await Subscription.updateMany(
        {
          "subscription.endDate": { $lt: now },
          "subscription.status": "active",
        },
        {
          $set: {
            "subscription.$[elem].status": "expired",
          },
        },
        {
          arrayFilters: [{ "elem.endDate": { $lt: now } }],
        }
      );

      console.log(
        `[CRON] Gym subscriptions expired: ${result.modifiedCount}`
      );
    } catch (error) {
      console.error("[CRON] Subscription expiry failed", error);
    }
  });
};
