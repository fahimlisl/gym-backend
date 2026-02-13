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
    foodId:{
      type:Schema.Types.ObjectId,
      ref:"Food"
    }
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
    desiredMacros:{
      protein: {
        grams: { type: Number, default: 0 },
        calories: { type: Number, default: 0 },
      },
      carbs: {
        grams: { type: Number, default: 0 },
        calories: { type: Number, default: 0 },
      },
      fats: {
        grams: { type: Number, default: 0 },
        calories: { type: Number, default: 0 },
      },
    },
     macroCaloriesTotal: {
      type: Number,
      default: 0,
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


dietSchema.pre("save",function(next) {
  this.desiredMacros.protein.calories = this.desiredMacros.protein.grams * 4;
  this.desiredMacros.carbs.calories = this.desiredMacros.carbs.grams * 4;
  this.desiredMacros.fats.calories = this.desiredMacros.fats.grams * 9;

  this.macroCaloriesTotal = this.desiredMacros.protein.calories + this.desiredMacros.carbs.calories + this.desiredMacros.fats.calories
  // next()
})


export const Diet = mongoose.model("Diet", dietSchema);
