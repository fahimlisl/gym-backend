import mongoose , { Schema } from "mongoose";

const dietSchema = new mongoose.Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    trainer: {
      type: Schema.Types.ObjectId,
      ref: "Trainer", // or Trainer (be consistent)
      required: true,
    },

    goal: {
      type: String,
      enum: ["fat loss", "muscle gain", "maintenance"],
      required: true,
    },

    calories: {
      type: Number,
      required: true,
    },

    dietType: {
      type: String,
      enum: ["veg", "non-veg", "vegan"],
      required: true,
    },

    mealsPerDay: {
      type: Number,
      default: 5,
    },

    plan: {
      type: Object, // AI JSON
      required: true,
    },

    generatedBy: {
      type: String,
      enum: ["ai", "trainer"],
      default: "ai",
    },

    status: {
      type: String,
      enum: ["draft", "approved"],
      default: "draft",
    },
  },
  { timestamps: true }
);

export const Diet = mongoose.model("Diet", dietSchema);
