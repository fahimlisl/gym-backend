import mongoose, { Schema } from "mongoose";

const trainerCouponSchema = new mongoose.Schema({
    trainerId:{
      type:Schema.Types.ObjectId,
      ref:"Trainer"
    },
    code: {
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
    },
    maxDiscount: {
      type: Number,
    },
    expiryDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usedCount: {
      type: Number,
      default: 0,
    }
},{timestamps:true})



export const TrainerCoupon = mongoose.model("TrainerCoupon",trainerCouponSchema)