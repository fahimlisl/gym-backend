import mongoose from "mongoose";

const cateGorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: true,
    },
    normalizedName: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: false }
);

export const CateGory = mongoose.model("CateGory", cateGorySchema);