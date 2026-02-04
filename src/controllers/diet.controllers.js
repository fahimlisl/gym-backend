import { Diet } from "../models/diet.models.js";
import { calculateCalories } from "../utils/calculateCalories.js";
import { buildDietPrompt } from "../utils/buildDietPrompt.js";
import { generateDietViaAI } from "../service/ai.service.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { User } from "../models/user.models.js";
import { DB_NAME } from "../constants.js";
import { MongoClient, ObjectId } from "mongodb";

const generateDiet = asyncHandler(async (req, res) => {
  const { userId, goal, dietType, mealsPerDay = 5, weight } = req.body;

  if (!goal || !dietType || !weight) {
    throw new ApiError(400, "Required fields missing");
  }

  const calories = calculateCalories({ weight, goal });

  // const prompt = buildDietPrompt({
  //   goal,
  //   calories,
  //   dietType,
  //   mealsPerDay,
  // });

  // const plan = await generateDietViaAI(prompt);

  const diet = await Diet.create({
    user: userId,
    generatedBy: req.user._id,
    goal,
    calories,
    dietType,
    mealsPerDay,
    // plan,
    // generatedBy: "ai",
    status: "draft",
  });

  const additionOfDietId = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        diet: diet._id,
      },
    },
    {
      new: true,
    }
  );

  if (!additionOfDietId) {
    // will add some deletation
    throw new ApiError(400, "failed to add generated diet id to user document");
  }

  res.status(201).json(new ApiResponse(201, diet, "Diet generated (draft)"));
});

const foodItemInserction = asyncHandler(async (req, res) => {
  const { userId, foods } = req.body;

  if (!foods || !foods.length) {
    throw new ApiError(400, "No foods provided");
  }

  const client = new MongoClient(`${process.env.MONGO_URI}/${DB_NAME}`);
  await client.connect();

  const database = client.db("alpha");
  const collection = database.collection("foods");

  const foodIds = foods.map((f) => new ObjectId(f.foodId));

  const foodDocs = await collection.find({ _id: { $in: foodIds } }).toArray();

  if (!foodDocs.length) {
    throw new ApiError(400, "Foods not found");
  }
  const preparedFoods = foods
    .map((input) => {
      const food = foodDocs.find((f) => f._id.toString() === input.foodId);

      if (!food) return null;

      const baseQty = food.baseQuantity || 100;
      const grams = input.grams || baseQty;

      const scale = grams / baseQty;

      return {
        foodId: food._id,
        foodName: food.foodName,
        servingSize: `${grams} g`,
        grams,
        baseQuantity: baseQty,

        calories: Math.round(food.nutrition.calories * scale),
        protein: +(food.nutrition.protein_g * scale).toFixed(2),
        carbs: +(food.nutrition.carbs_g * scale).toFixed(2),
        fats: +(food.nutrition.fat_g * scale).toFixed(2),
        fiber: +(food.nutrition.fiber_g * scale).toFixed(2),
        sugar: +(food.nutrition.sugar_g * scale).toFixed(2),
        sodium: +(food.nutrition.sodium_mg * scale).toFixed(2),
      };
    })
    .filter(Boolean);

  preparedFoods.forEach((f) => {
    Object.values(f).forEach((v) => {
      if (typeof v === "number" && Number.isNaN(v)) {
        throw new ApiError(400, "Invalid nutrition calculation");
      }
    });
  });

  const updatedDiet = await Diet.findOneAndUpdate(
    { user: userId },
    {
      $push: {
        foods: { $each: preparedFoods },
      },
    },
    { new: true }
  );

  if (!updatedDiet) {
    throw new ApiError(500, "Failed to update diet");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedDiet,
        "Foods added successfully (grams based)"
      )
    );
});

const approveDiet = asyncHandler(async (req, res) => {
  const { dietId } = req.params;

  const diet = await Diet.findByIdAndUpdate(
    dietId,
    { status: "approved" },
    { new: true }
  );

  if (!diet) {
    throw new ApiError(404, "Diet not found");
  }

  res.json(new ApiResponse(200, diet, "Diet approved successfully"));
});

const getMyDiet = asyncHandler(async (req, res) => {
  const diet = await Diet.findOne({
    user: req.user._id,
    status: "approved",
  }).sort({ createdAt: -1 });

  if (!diet) {
    throw new ApiError(404, "No approved diet found");
  }

  res.json(new ApiResponse(200, diet, "Diet fetched successfully"));
});

const checkIfDietExists = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const diet = await Diet.findOne({ user: userId }).select("_id status");

  if (!diet) {
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { exists: false },
          "Diet does not exist for this user"
        )
      );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        exists: true,
        dietId: diet._id,
        status: diet.status,
      },
      "Diet exists for this user"
    )
  );
});

const showParticularDiet = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const diet = await Diet.findOne({ user: userId });
  if (!diet) throw new ApiError(400, "diet is not created yet");
  return res
    .status(200)
    .json(
      new ApiResponse(200, diet, "diet of the user being successfully fetched")
    );
});

const approveCheck = asyncHandler(async(req,res) => {
  const dietId  = req.params.id;
  const diet = await Diet.findById(dietId);
  if(!diet) throw new ApiError(400,"wasn't able to found die document");
  if(diet.status === "approved"){
    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        diet.status,
        "diet status , been checked , status approved!"
      )
    )
  }else{
    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        diet.status,
        "diet status , been checked , are in draft , waiting for approval!"
      )
    )
  }
})

export {
  foodItemInserction,
  showParticularDiet,
  generateDiet,
  approveDiet,
  getMyDiet,
  checkIfDietExists,
  approveCheck
};
