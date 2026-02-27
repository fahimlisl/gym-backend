import { Admin } from "../models/admin.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import generateAccessAndRefreshToken from "../utils/generateANR.js";
import { options } from "../utils/options.js";

const registerAdmin = asyncHandler(async (req, res) => {
  const { username, email, password, phoneNumber } = req.body;

  if ([username, email, password].some((fild) => fild.trim() === "")) {
    throw new ApiError(401, "all fields are required");
  }
  // validation of email via forntend
  if (!phoneNumber) throw new ApiError(400, "phone Number must required");

  const admin = await Admin.create({
    username,
    email,
    password,
    phoneNumber,
  });

  const createdAdmin = await Admin.findById(admin._id).select(
    "-password -refreshToken"
  );

  if (!createdAdmin) {
    throw new ApiError(
      500,
      "internal erorr , admin was not abel to be created"
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, admin, "admin created sucessfully"));
});

const cookieOptions = {
  httpOnly: true,
  secure: true,      
  sameSite: "none",    
  path: "/",
};

const loginAdmin = asyncHandler(async (req, res) => {
  const { phoneNumber, email, password } = req.body;
  if (!(phoneNumber || email)) {
    throw new ApiError(400, "Phone number or email required");
  }
  if (!password) {
    throw new ApiError(400, "Password required");
  }

  const loginUser = await Admin.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (!loginUser) {
    throw new ApiError(401, "User doesn't exist");
  }

  const isMatch = await loginUser.isPasswordCorrect(password);

  if (!isMatch) {
    throw new ApiError(401, "Incorrect password");
  }

  const { accessToken, refreshToken } =
    await generateAccessAndRefreshToken(loginUser._id, Admin);

  const safeUser = await Admin.findById(loginUser._id).select(
    "-password -refreshToken"
  );

  res.cookie("accessToken", accessToken, cookieOptions);
  res.cookie("refreshToken", refreshToken, cookieOptions);

  return res.status(200).json({
    success: true,
    message: "Admin logged in successfully",
    loginUser: safeUser,
    accessToken,
    refreshToken,
  });
});


const logOutAdmin = asyncHandler(async (req, res) => {
  await Admin.findByIdAndUpdate(req.user._id, {
    $unset: { refreshToken: 1 },
  });

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "Admin logged out successfully",
  });
});


export { registerAdmin, loginAdmin, logOutAdmin };