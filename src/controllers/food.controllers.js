import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import axios from "axios";
import { ApiResponse } from "../utils/ApiResponse.js";
import {MongoClient} from "mongodb"
import { DB_NAME } from "../constants.js";

const client = new MongoClient(`${process.env.MONGO_URI}/${DB_NAME}`)


const getAllFoods = asyncHandler(async(req,res) => {
  try {
    await client.connect();
    const database = client.db('alpha');
    const collection = database.collection('foods');
    
    const foods = await collection.find({}).toArray();
    
    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        foods,
        "foods being succesfully fetched"
      )
    )
  } catch (error) {
    console.error('Error fetching foods:', error);
    throw error;
  } finally {
    await client.close();
  }
})


const addFood = asyncHandler(async (req, res) => {
  const { foodName } = req.body;

  if (!foodName) {
    return res.status(400).json(
      new ApiResponse(400, null, "foodName is required")
    );
  }

  await axios.post(
    "https://n8n.fahim.in/webhook/food-nutrition",
    { foodName }
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      null,
      "Food sent for nutrition processing"
    )
  );
});


export {getAllFoods,addFood}