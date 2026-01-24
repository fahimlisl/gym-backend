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

const loginAdmin = asyncHandler(async (req, res) => {
  const { phoneNumber, email, password } = req.body;

  if (!(phoneNumber || email)) {
    throw new ApiError(401, "Phone Number or email requied");
  }

  if (!password) {
    throw new ApiError(401, "password required");
  }

  const loginUser = await Admin.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (!loginUser) {
    throw new ApiError(401, "user doesn't exist");
  }

  const checkPassword = await loginUser.isPasswordCorrect(password);

  if (!checkPassword) {
    throw new ApiError(401, "please enter correct password");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    loginUser._id,
    Admin
  );

  const loggedInUserAlready = await Admin.findById(loginUser._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        { loginUser: loggedInUserAlready, accessToken, refreshToken },
        "admin logged in successfully"
      )
    );
});

const logOutAdmin = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (!userId) {
    throw new ApiError(
      400,
      "userId wasn't able to found , unauthroized access"
    );
  }
  const user = await Admin.findById(req.user._id);
  if (!user) {
    throw new ApiError(
      400,
      "user isn't logged in yet , or unauthorized access"
    );
  }
  await Admin.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: "" },
    },
    {
      new: true,
    }
  );

  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, `admin logged out successfully`));
});

export { registerAdmin, loginAdmin, logOutAdmin };
