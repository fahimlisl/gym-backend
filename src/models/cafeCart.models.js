//   status: {
//     type: String,
//     enum: ["completed", "cancelled"],
//     default: "completed",
//   },

import mongoose, { Schema } from "mongoose";

const cafeCartSchema = new mongoose.Schema(
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
          min: 1,
          default: 1,
        },
        name: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
        },
      },
    ],

    totalAmount: {
      type: Number,
      // required: true,
    },

    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card"], // if upi then need to store the upi transaction id
      // required: true,
      upiRef: {
        type: String, // only if upi
      },
    },

    customer: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    handledBy: {
      type: Schema.Types.ObjectId,
      ref: "CafeAdmin",
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
  },
  { timestamps: true }
);

export const CafeCart = mongoose.model("CafeCart", cafeCartSchema);
