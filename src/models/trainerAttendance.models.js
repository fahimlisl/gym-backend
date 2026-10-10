import mongoose, { Schema } from "mongoose";

const trainerAttendanceSchema = new mongoose.Schema(
  {
    trainer: {
      type: Schema.Types.ObjectId,
      ref: "Trainer",
      required: true,
    },
    schedule:{
      type: Schema.Types.ObjectId,
      ref: "StaffSchedule",
      required:true
    },
    date: {
      type: String,
      required: true,
    },
    type:{
      type:String,
      enum:["check in","check out","break out","break in","excess out","excess in"],
      required:true
    },
    source: {
      type: String,
      enum: ["MANUAL", "QR", "AUTO","FACIAL"],
      default: "MANUAL",
    },
  },
  { timestamps: true }
);

trainerAttendanceSchema.index({
  trainer: 1,
  date: 1,
  createdAt: 1,
});

export const TrainerAttendance = mongoose.model("TrainerAttendance", trainerAttendanceSchema);