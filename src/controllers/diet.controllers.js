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
import mongoose from "mongoose";

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

const editCalories = asyncHandler(async(req,res) => {
  const dietId = req.params.dietId;
  const {calories} = req.body;
  const diet = await Diet.findById(dietId);
  if (!diet) {
    throw new ApiError(404, "Diet not found");
  }
  diet.calories = calories;
  await diet.save({validateBeforeSave:false})
  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      calories,
      "diet has been updated successfully!"
    )
  )
})

const setDietMacros = asyncHandler(async (req, res) => {
  const dietId = req.params.id;

  // Convert safely FIRST
  const protein = Number(req.body.protein);
  const carbs = Number(req.body.carbs);
  const fats = Number(req.body.fats);

  if (
    Number.isNaN(protein) ||
    Number.isNaN(carbs) ||
    Number.isNaN(fats)
  ) {
    throw new ApiError(400, "Invalid macro values");
  }

  const diet = await Diet.findById(dietId);

  if (!diet) {
    throw new ApiError(404, "Diet not found");
  }

  const macroCalories =
    protein * 4 +
    carbs * 4 +
    fats * 9;

  if (Math.abs(macroCalories - diet.calories) > 50) {
    throw new ApiError(
      400,
      "Macro calories do not match total calories"
    );
  }

  diet.desiredMacros = {
    protein: { grams: protein },
    carbs: { grams: carbs },
    fats: { grams: fats },
  };

  await diet.save();

  res.json(
    new ApiResponse(200, diet, "Macros set successfully")
  );
});

const createMeal = asyncHandler(async(req,res) => {
  const dietId = req.params.id;
  const {meal} = req.body; // will be checking wehather diet meal type is already added or not!
  if(!meal) throw new ApiError(400,"meal field is must required!");
  const die = await Diet.findById(dietId)
  const i = die.meals.find((m) => m.meal === meal)

  if(i) throw new ApiError(400,"meal type already exists!");

  die.meals.push({meal})
  await die.save();
  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      die,
      "meal type is added successfully"
    )
  )
})

const removeMeal = asyncHandler(async(req,res) => {
  const mealId = req.params.mealId;
  const dietId = req.params.dietId;
  if(!mealId) throw new ApiError(400,"wasn't able to find meal id!");
  const updatedDiet = await Diet.findByIdAndUpdate(dietId,
    {
      $pull:{
        meals:{
          _id:mealId
        }
      }
    },
    {
      new:true
    }
  );
  if(!updatedDiet) throw new ApiError(400,"wasn't able to remove meal from diet!");
  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      updatedDiet,
      "diet has been updated successfully!"
    )
  )
});


const foodItemInserction = asyncHandler(async (req, res) => {
  const { userId, foods } = req.body;
  const mealId = req.params.mealId;
  if (!mongoose.Types.ObjectId.isValid(mealId)) {
  throw new ApiError(400, "Invalid meal ID");
}
if (!mongoose.Types.ObjectId.isValid(userId)) {
  throw new ApiError(400, "Invalid user ID");
}


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

  // const updatedDiet = await Diet.findOneAndUpdate(
  //   { user: userId },
  //   {
  //     $push: {
  //       foods: { $each: preparedFoods },
  //     },
  //   },
  //   { new: true }
  // );
  const updatedDiet = await Diet.findOneAndUpdate(
  {
    user: userId,
    "meals._id": mealId
  },
  {
    $push: {
      "meals.$.foods": {
        $each: preparedFoods
      }
    }
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

const removeItemFromDiet = asyncHandler(async(req,res) => {
  const {foodId,userId,mealId} = req.params;


  const diet = await Diet.findOneAndUpdate({
    user:userId,
    "meals._id":mealId
  },
    {
      $pull:{
        // foods:{
        //   foodId: new mongoose.Types.ObjectId(foodId)
        // }
        "meals.$.foods":{
         foodId: new mongoose.Types.ObjectId(foodId)
        }
      }
    },
    {
      new:true
    }
  );
  
  if(!diet) throw new ApiError(400,"diet wasn't able to update, internal server error!");
  
  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      diet,
      "diet have been updated successfully !"
    )
  )
})

const approveDiet = asyncHandler(async (req, res) => {
  const { dietId } = req.params;
  
  const status = req.body?.status || "approved";

  const diet = await Diet.findByIdAndUpdate(
    dietId,
    { status: status || "approved" }, 
    { new: true }
  );

  if (!diet) {
    throw new ApiError(404, "Diet not found");
  }

  const message = status === "draft" 
    ? "Diet unlocked for editing" 
    : "Diet approved successfully";

  res.json(new ApiResponse(200, diet, message));
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
  approveCheck,
  setDietMacros,
  removeItemFromDiet,
  createMeal,
  removeMeal,
  editCalories
};