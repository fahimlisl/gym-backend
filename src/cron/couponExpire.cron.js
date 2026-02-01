import cron from "node-cron";
import { Coupon } from "../models/coupon.models.js";

console.log(`cron has been successfully invoked`)

cron.schedule(
  "0 * * * *", // every hour
  async () => {
    try {
      const now = new Date(); // UTC time

      const result = await Coupon.updateMany(
        {
          isActive: true,
          expiryDate: { $lte: now },
        },
        {
          $set: { isActive: false },
        }
      );

      console.log(
        `[CRON] Coupons expired: ${result.modifiedCount}`
      );
    } catch (error) {
      console.error("[CRON] Coupon expiry failed", error);
    }
  },
  {
    timezone: "UTC",
  }
);
