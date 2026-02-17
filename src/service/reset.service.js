import { Admin } from "../models/admin.models.js";
import { User } from "../models/user.models.js";
import { Trainer } from "../models/trainer.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import axios from "axios";
import { options } from "../utils/options.js";

console.log("onboarding");
const generateresetPasswordToken = (Model) =>
  asyncHandler(async (req, res) => {
    const { email, phoneNumber } = req.body;
    if (!(email || phoneNumber))
      throw new ApiError(400, "email or phone number required!");
    const user = await Model.findOne({
      $or: [{ email }, { phoneNumber }],
    });
    if (!user) throw new ApiError(400, "check email or phone number!");
    const otp = Math.round(Math.random() * 1000000);
    const token = jwt.sign(
      {
        OTP: otp,
        _id: user._id,
      },
      process.env.RESET_PASSWORD_TOKEN,
      {
        expiresIn: process.env.RESET_PASSWORD_EXPIRY,
      }
    );

    if (!token)
      throw new ApiError(
        400,
        "got error while generating reset password token!"
      );

    user.resetPasswordToken = token;
    await user.save({ validateBeforeSave: false });

    try {
      await axios.post(process.env.N8N_RESET_PASSWORD_URL, {
        eventType: "reset_password",
        name: user.username,
        otp: otp,
        email: email || "",
        phoneNumber: phoneNumber,
      });
    } catch (error) {
      console.error("Failed to trigger n8n webhook:", error);
    }

    return res
      .status(200)
      .cookie("resetPasswordToken", token, options)
      .json(
        new ApiResponse(
          200,
          {},
          "reset refresh token has been successfully generated and saved to database!"
        )
      );
  });

const validateOTPandChangePassword = (Model) =>
  asyncHandler(async (req, res) => {
    const { otp, newPassword, confirmNewPassword } = req.body;
    if (!(newPassword === confirmNewPassword))
      throw new ApiError(
        400,
        "new password and confirm new password must be same!"
      );
    if (otp.length < 6 && otp.length > 6)
      throw new ApiError(400, "otp must contain 6 digits!");
    const token =
      req.cookies?.resetPasswordToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    const decodedToken = jwt.verify(token, process.env.RESET_PASSWORD_TOKEN);
    if (!decodedToken)
      throw new ApiError(400, "unauthorized ! token didn't matched !");

    const k = decodedToken.OTP;
    if (k !== Number(otp)) throw new ApiError(400, "otp didn't matched !");

    const user = await Model.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );
    if (!user)
      throw new ApiError(402, "something went wrong while finding user!");

    user.password = newPassword;
    user.resetPasswordToken = null; // will cchange this later
    await user.save();

    return res
      .status(200)
      .clearCookie("resetPasswordToken", options)
      .json(new ApiResponse(200, {}, "password has been successfully reset!"));
  });

export { generateresetPasswordToken, validateOTPandChangePassword };