import cron from "node-cron";
import { Trainer } from "../models/trainer.models.js";

cron.schedule("0 0 1 * *", async () => {
  try {
    const result = await Trainer.updateMany(
      {},
      { $set: { "bonus.monthBonus": 0 } }
    );
    console.log(`[CRON] monthBonus reset for ${result.modifiedCount} trainers`);
  } catch (error) {
    console.error("[CRON] Failed to reset monthBonus:", error);
  }
}, {
  timezone: "Asia/Kolkata"
});

console.log("[CRON] Monthly bonus reset job scheduled");