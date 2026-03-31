import mongoose, { Schema } from "mongoose";

const trainerAttendanceSchema = new mongoose.Schema(
  {
    trainer: {
      type: Schema.Types.ObjectId,
      ref: "Trainer",
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    checkIn: {
      type: Date,
      default: Date.now,
    },
    checkOut: {
      type: Date,
    },
    source: {
      type: String,
      enum: ["MANUAL", "QR", "AUTO"],
      default: "MANUAL",
    },
  },
  { timestamps: true }
);

trainerAttendanceSchema.index({ trainer: 1, date: 1 }, { unique: true });

export const TrainerAttendance = mongoose.model("TrainerAttendance", trainerAttendanceSchema);