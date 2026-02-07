import mongoose from "mongoose";

const couponSchema = new mongoose.Schema(
  {
    code: {
      // *
      type: String,
      required: true,
    },
    typeOfCoupon: {
      type: String,
      enum: ["flat", "percentage"],
    },
    value: {
      type: Number,
      required: true,
    },
    minCartAmount: {
      type: Number,
      // optional
    },
    maxDiscount: {
      type: Number,
      // required:true // not required as per now
    },
    expiryDate: {
      // *
      type: Date,
    },
    isActive: {
      // *
      type: Boolean,
      default: true,
    },
    category: {
      type: String,
      enum: ["CAFE", "ADMISSION", "SUBSCRIPTION", "PERSONAL TRAINING"], // WILL CONTROLE THIS VIA FRONTEND,
      required: true,
    },
    // - usageLimit (global or per user) // will implement later as per requirments
  },
  { timestamps: true }
);

export const Coupon = mongoose.model("Coupon", couponSchema);