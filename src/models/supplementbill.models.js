import mongoose from "mongoose";

const supplementBillSchema = new mongoose.Schema(
  {
      userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    guestInfo: {
      fullName: { type: String },
      phone: { type: String },
      email: { type: String },
    },

    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        productName: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
        subtotal: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],

    discount: {
      amount: {
        type: Number,
        // default: 0,
        // min: 0,
      },
      typeOfDiscount: {
        type: String,
        enum: ["percentage", "flat"],
        // default: "percentage",
      },
      value: {
        type: Number,
        default: 0,
        min: 0,
      },
      code: {
        type: String,
        uppercase: true,
      },
    },

    subtotal: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    discountAmount: {
      type: Number,
      // default: 0,
      // min: 0,
    },
    total: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },

    // we don't need it now
    // // Shipping and additional info
    // shippingAddress: {
    //   fullName: String,
    //   email: String,
    //   phone: String,
    //   address: String,
    //   city: String,
    //   state: String,
    //   zipCode: String,
    //   country: String,
    // },

    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "netbanking", "razorpay"],
    },

    notes: String,
  },
  { timestamps: true }
);


export const SupplementBill = mongoose.model(
  "SupplementBill",
  supplementBillSchema
);
