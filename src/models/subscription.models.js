import mongoose, { Schema } from "mongoose";

const subsSchema = new mongoose.Schema(
  {
    plan: {
      type: String,
      enum: ["monthly", "quarterly", "half-yearly", "yearly"],
      required: true,
    },
    price: {
      type: Number,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    endDate: {
      type: Date,
      required: true, // will be auto claculated
    },

    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active", // need to write status algorith in contorller
    },

    paymentStatus: {
      type: String,
      enum: ["paid", "pending"],
      default: "paid",
    },
  },
  {}
);

const subscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscription:{
      type:[subsSchema]
    }
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
