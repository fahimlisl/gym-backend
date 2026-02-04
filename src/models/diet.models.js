import mongoose, { Schema } from "mongoose";

const foodSchema = new mongoose.Schema(
  {
    foodName: {
      type: String,
      required: true,
    },
    calories: {
      type: Number,
      required: true,
    },
    servingSize: {
      type: String,
    },
    protein: {
      type: Number,
    },
    carbs: {
      type: Number,
    },
    fats: {
      type: Number,
    },
    fiber: {
      type: Number,
    },
    sugar: {
      type: Number,
    },
  },
  { timestamps: true }
);

const dietSchema = new mongoose.Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    goal: {
      type: String,
      enum: ["fat loss", "muscle gain", "maintenance"],
      required: true,
    },

    calories: {
      // total calorie will be evealuated via backend logic
      type: Number,
      required: true,
    },

    dietType: {
      type: String,
      enum: ["veg", "non-veg", "vegan", "general"],
      required: true,
    },

    mealsPerDay: {
      type: Number,
      default: 5,
    },

    // plan: {
    //   type: Object,
    //   required: true,
    // },

    generatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Trainer",
      // enum: ["ai", "trainer"],
      // default: "ai",
    },

    status: {
      type: String,
      enum: ["draft", "approved"],
      default: "draft",
    },
    foods:{
      type:[foodSchema]
  }
  },
  { timestamps: true }
);

export const Diet = mongoose.model("Diet", dietSchema);
