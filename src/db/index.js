import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

export const connectDB = async() => {
    try {
        const connection = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
        console.log(`mongo DB conecction successful ${connection}`)
    } catch (error) {
        console.log(`got error while connection to mongo db , error : ${error}`)
        process.exit(0);
    }
}