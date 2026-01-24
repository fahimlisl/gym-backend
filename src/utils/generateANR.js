import { ApiError } from "./ApiError.js";

const generateAccessAndRefreshToken = async function (userId, Model) {
  try {
    const user = await Model.findById(userId);
    
    const refreshToken = user.generateRefreshToken();
    const accessToken = user.generateAccessToken();
  
    await Model.findByIdAndUpdate(userId,{
      $set:{
          refreshToken:refreshToken
      }
    })
    return {refreshToken,accessToken}
  } catch (error) {
    throw new ApiError(500,"failed to generate refresh and access token throgh the utils , folder")
  }
};


export default generateAccessAndRefreshToken