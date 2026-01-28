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
      required: true,
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
    discountType:{
      type:String,
      enum:["percentage","flat","none"],
      required:true // will be controllring via forntend  , like if discount is enabling then only give the require thing , 
      // also need to control the percentage , form 0-100 , via forntend , 
    },
    discount:{ // there will the two types of discount , 1) percentage wise 2) manual
      type:Number,
      default:0
    },
    finalAmount:{
      type:Number,
      required:true
    }
  },
  {timestamps:true}
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
    },
    admissionFee:{  // keeping it as per now will change according to instructions
      type:Number,
      required:true
    },
    discountTypeOnAdFee:{
      type:String,
      enum:["percentage","flat","none"],
      required:true // will be controllring via forntend  , like if discount is enabling then only give the require thing , 
      // also need to control the percentage , form 0-100 , via forntend , 
    },
    discountOnAdFee:{
      type:Number
    },
    finalAdFee:{
      type:Number
    }
  },
  { timestamps: true }
);

export const Subscription = mongoose.model("Subscription", subscriptionSchema);
