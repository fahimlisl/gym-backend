import mongoose, { Schema } from "mongoose";

const breakSchema = new Schema(
  {
    name: {
      type: String,
      default: "Break",
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    gracePeriodMinutes: {
      type: Number,
      default: 10,
    },
    paid: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
  }
);


const staffScheduleSchema = new Schema(
  {
    trainer: {
      type: Schema.Types.ObjectId,
      ref: "Trainer",
      required: true,
      index: true,
    },

    shiftStart: {
      type: String,
      required: true,
    },

    shiftEnd: {
      type: String,
      required: true,
    },

    breaks: {
      type: [breakSchema],
      default: [],
    },

    daysOfWeek: [
      {
        type: Number,
        min: 0,
        max: 6,
      },
    ],

    gracePeriodMinutes: {
      type: Number,
      default: 10,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);


export const StaffSchedule = mongoose.model("StaffSchedule",staffScheduleSchema);