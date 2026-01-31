import mongoose, { Schema } from "mongoose";

const cafeOrderSchema = new mongoose.Schema(
  {
    items: [
      {
        item: {
          type: Schema.Types.ObjectId,
          ref: "CafeItem",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        priceAtPurchase: {
          type: Number,
          required: true, // snapshot of price at checkout
        },
        name:{
          type:String,
          required:true
        }
      },
    ],

    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null, // optional (walk-in customer)
    },

    totalAmount: {
      type: Number,
      required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card"],
      required: true,
    },

    upiRef: {
      type: String,
      required: function () {
        return this.paymentMethod === "upi";
      },
    },

    status: {
      type: String,
      enum: ["completed", "cancelled", "refunded"],
      default: "completed",
    },

    handledBy: {
      type: Schema.Types.ObjectId,
      ref: "CafeAdmin",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const CafeOrder = mongoose.model("CafeOrder", cafeOrderSchema);
