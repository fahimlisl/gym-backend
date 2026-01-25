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
    price: {
      type: Number,
      required: true, // have to apply option for copun
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
