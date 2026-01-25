import { Diet } from "../models/diet.models.js";
import { calculateCalories } from "../utils/calculateCalories.js";
import { buildDietPrompt } from "../utils/buildDietPrompt.js";
import { generateDietViaAI } from "../service/ai.service.js";

import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {asyncHandler} from "../utils/AsyncHandler.js";

export const generateDiet = asyncHandler(async (req, res) => {
  const {
    userId,
    goal,
    dietType,
    mealsPerDay = 5,
    weight,
  } = req.body;

  if (!userId || !goal || !dietType || !weight) {
    throw new ApiError(400, "Required fields missing");
  }

  const calories = calculateCalories({ weight, goal });

  const prompt = buildDietPrompt({
    goal,
    calories,
    dietType,
    mealsPerDay,
  });

  const plan = await generateDietViaAI(prompt);

  const diet = await Diet.create({
    user: userId,
    trainer: req.user._id,
    goal,
    calories,
    dietType,
    mealsPerDay,
    plan,
    generatedBy: "ai",
    status: "draft",
  });

  res.status(201).json(
    new ApiResponse(201, diet, "Diet generated (draft)")
  );
});

// diet approval
export const approveDiet = asyncHandler(async (req, res) => {
  const { dietId } = req.params;

  const diet = await Diet.findByIdAndUpdate(
    dietId,
    { status: "approved" },
    { new: true }
  );

  if (!diet) {
    throw new ApiError(404, "Diet not found");
  }

  res.json(
    new ApiResponse(200, diet, "Diet approved successfully")
  );
});


export const getMyDiet = asyncHandler(async (req, res) => {
  const diet = await Diet.findOne({
    user: req.user._id,
    status: "approved",
  }).sort({ createdAt: -1 });

  if (!diet) {
    throw new ApiError(404, "No approved diet found");
  }

  res.json(
    new ApiResponse(200, diet, "Diet fetched successfully")
  );
});
