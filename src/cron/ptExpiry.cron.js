import cron from "node-cron";
import { Ptbill } from "../models/ptbill.models.js";

console.log(`cron has been successfully invoked for pt bill`)

export const ptExpiryJob = () => {
  // Runs every day at 12:10 AM
  cron.schedule("10 0 * * *", async () => {
    try {
      const now = new Date();

      const result = await Ptbill.updateMany(
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
        `[CRON] PT subscriptions expired: ${result.modifiedCount}`
      );
    } catch (error) {
      console.error("[CRON] PT expiry failed", error);
    }
  });
};
