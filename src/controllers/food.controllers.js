import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
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


export {getAllFoods}