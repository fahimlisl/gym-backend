import mongoose, { Schema } from "mongoose";

const tempPtBillSchema = new mongoose.Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trainer: {
      type: Schema.Types.ObjectId,
      ref: "Trainer",
      //   required: true, // need to modify as we go on the go
    },

    plan: {
      type: String,
      enum: ["monthly", "quarterly", "half-yearly", "yearly"],
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "paused", "expired"],
      default: "active",
    },

    basePrice: {
      type: Number,
      required: true,
    },

    discount: {
      amount: {
        type: Number,
      },
      typeOfDiscount: {
        type: String,
      },
      value: {
        type: Number,
      },
      code: {
        type: String,
      },
    },

    finalPrice: {
      type: Number,
      required: true,
    },

    image: {
      // will be screenshot or proof
      url: {
        type: String,
        required: true,
      },
      public_id: {
        type: String,
        required: true,
      },
    },

    isApproved: {
      type: Boolean,
      required: true,
      default: false,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "netbanking"],
      required: true,
    },
    // upiRef: {
    ref: {
      type: String,
      required: function () {
        return this.paymentMethod === "upi";
      },
    },
  },
  { timestamps: true }
);

export const TempPtBill = mongoose.model("TempPtBill", tempPtBillSchema);