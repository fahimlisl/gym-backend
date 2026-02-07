import cron from "node-cron";
import { Subscription } from "../models/subscription.models.js";

console.log("✅ Subscription expiry cron loaded");

export const subscriptionExpiryJob = () => {
  // Runs every day at 12:20 AM
  cron.schedule("20 0 * * *", async () => {
    try {
      const now = new Date();

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

      console.log(
        `[CRON] Expired ${result.modifiedCount} subscription(s)`
      );
    } catch (error) {
      console.error(
        "[CRON] Subscription expiry failed",
        error
      );
    }
  });
};
