import mongoose, { Schema } from "mongoose";

const supplementSchema = new mongoose.Schema(
  {
    productName: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Pre WorkOut",
        "Protien",
        "Creatien",
        "BCAA",
        "L-Arginine",
        "Fish Oil",
      ], // will add more as per requirment
    },
    barcode:{
      type:String,
    },
    salePrice: {
      type: Number, // remove index from mongodb
    },
    quantity: { // will decrase one by one , when cafe items orders are placed one by one
      type: Number,
      required: true,
    },
    purchasePrice:{
      type: Number,
    },
    description: {
      type: String,
      required: true,
    },
    review: {
      star: {
        type: Number,
        enum: [1, 2, 3, 4, 5],
      },
      details: {
        type: String,
      },
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    },
    images: [
      {
        url: {
          type: String,
        },
        public_id: {
          type: String,
          required: true,
        },
        isThumbnail: {
          type: Boolean,
          default: false,
        },
      },
    ],
  },
  { timestamps: true }
);

export const Supplement = mongoose.model("Supplement", supplementSchema);
