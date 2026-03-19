import mongoose from "mongoose";

const offerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true, // "50% OFF"
    },
    description: {
      type: String, // "For first 100 memberships"
    },
    discountType: {
      type: String,
      enum: ["flat", "percentage"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true, // 50 (for 50%)
    },
    totalSlots: {
      type: Number, // e.g. 100
      required: true,
    },
    maxDiscount: {
      type: Number,
    },
    minAmount: {
      type: Number,
    },
    coupon: {
        type:String,
        required:true
    },
    category: {
      type: String,
      enum: ["SUBSCRIPTION", "PT", "ADMISSION", "CAFE"],
      required: true,
    },
    startDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    badgeText: {
      type: String, // "LIMITED TIME OFFER"
      default: "LIMITED TIME OFFER",
    },

  },
  {
    timestamps: true
  }
);

export const Offer = mongoose.model("Offer",offerSchema)