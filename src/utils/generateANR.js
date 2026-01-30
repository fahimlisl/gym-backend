import { ApiError } from "./ApiError.js";
import { Admin } from "../models/admin.models.js";
import { User } from "../models/user.models.js";
import { Trainer } from "../models/trainer.models.js";
import { CafeAdmin } from "../models/cafeAdmin.models.js";

const generateAccessAndRefreshToken = async (userId, Model) => {
  try {
    const user = await Model.findById(userId);
    
    const refreshToken = await user.generateRefreshToken();
    const accessToken = await user.generateAccessToken();

    await Model.findByIdAndUpdate(user._id,{
      $set:{
          refreshToken:refreshToken
      }
    },
  {
    new:true
  })
    return {refreshToken,accessToken}
  } catch (error) {
    console.log(error)
    throw new ApiError(500,"failed to generate refresh and access token throgh the utils , directory")
  }
};


export default generateAccessAndRefreshToken;