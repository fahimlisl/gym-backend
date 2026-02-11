import mongoose,{Schema} from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    member: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
    },

    checkIn: {
      type: Date,
      default: Date.now,
    },

    checkOut: { // optional
      type: Date,
    },

    markedBy: {
      type: Schema.Types.ObjectId,
      ref: "User", // ADMIN / TRAINER
    },

    source: {
      type: String,
      enum: ["MANUAL", "QR", "AUTO"],
      default: "MANUAL",
    },
  },
  { timestamps: true }
);

// prevents duplicate attendance
attendanceSchema.index({ member: 1, date: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", attendanceSchema);
