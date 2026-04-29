import {v2 as cloudinary} from "cloudinary"
import { ApiError } from "./ApiError.js"
import dotenv from "dotenv"
dotenv.config({
    path:"./.env"
})

cloudinary.config({
    cloud_name:process.env.CLOUDINARY_CLOUD_NAME,
    api_key:process.env.CLOUDINARY_API_KEY,
    api_secret:process.env.CLOUDINARY_API_SECRET
})

const uploadOnCloudinary = async (fileBuffer) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      { folder: "gym" , resource_type:"auto"},
      (error, result) => {
        if (error) return reject(error);
        resolve({
          url: result.secure_url,
          public_id: result.public_id,
        });
      }
    ).end(fileBuffer);
  });
};


const deleteFromCloudinary = async (filePath) => {
  try {
    if (!filePath) {
      throw new ApiError(400, "file wasn't able to be found");
    }
    console.log("deleting cloduainry files in here")

    let result = await cloudinary.uploader.destroy(filePath, {
      resource_type: "image",
    });

    if (result.result === "not found") {
      result = await cloudinary.uploader.destroy(filePath, {
        resource_type: "raw",
      });
    }

    if (result.result === "not found") {
      throw new ApiError(500, "File not found in Cloudinary");
    }

    return result;
  } catch (error) {
    throw new ApiError(
      500,
      error.message || `Got error while deleting file from Cloudinary`
    );
  }
};

export {uploadOnCloudinary,deleteFromCloudinary}