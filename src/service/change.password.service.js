import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Admin } from "../models/admin.models.js";
import { User } from "../models/user.models.js";
import { Trainer } from "../models/trainer.models.js"

export const changePassword = (Model) => asyncHandler(async(req,res) => {
  const {oldPassword,newPassword,confirmNewPassword} = req.body;
  const userId = req.user._id;
  if([oldPassword,newPassword,confirmNewPassword].some((t) => t?.trim() === "")){
    throw new ApiError(400,"all feilds are required!");
  }
  const user = await Model.findById(userId);
  const checkPassword = await user.isPasswordCorrect(oldPassword);
  if(!checkPassword) throw new ApiError(400,"check old password, password didn't matched!");

  if(!(newPassword === confirmNewPassword)) throw new ApiError(400,"new password and confrim new password must be same!");
  user.password = newPassword;
  await user.save()

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      user,
      "password have been changed successfully!"
    )
  )
})