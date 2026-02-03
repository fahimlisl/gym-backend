import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // required: true,
    },

    source: {
      type: String,
      enum: ["subscription", "supplement", "personal-training","cafe","expense"],
      required: true,
    },

    subReferenceId:{
      type: mongoose.Schema.Types.ObjectId,
      // this is sub reference for inserting the object of sub document under main document , 
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "referenceModel",
      // subscriptionId or orderId
    },

    referenceModel: {
      type: String,
      required: true,
      enum: [
        "Subscription",
        "Supplement",
        "Ptbill",
        "CafeOrder",
        "Expense",
      ],
    },

    amount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "netbanking"],
      required: true,
    },

    status: {
      type: String,
      enum: ["success", "failed", "refunded"],
      default: "success",
    },

    paidAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const Transaction = mongoose.model(
  "Transaction",
  transactionSchema
);
