import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import generateAccessAndRefreshToken from "../utils/generateANR.js";
import { options } from "../utils/options.js";
import { CafeAdmin } from "../models/cafeAdmin.models.js";

const addCafeAdmin = asyncHandler(async (req, res) => {
  const { username, password, email, phoneNumber, salary } = req.body;
  if ([username, password, phoneNumber].some((t) => !t && t !== 0)) {
    throw new ApiError(400, "userame password and phone number must required");
  }

  const user = await CafeAdmin.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (user)
    throw new ApiError(
      400,
      "user already exists , with the given email or phone number"
    );

  const cafe = await CafeAdmin.create({
    username,
    password,
    email: email || null,
    phoneNumber,
    salary: salary || null,
  });

  if (!cafe)
    throw new ApiError(500, "internal server error , failed to add cafe staff");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        cafe,
        "cafe admin staff has been successfully registerd to the db"
      )
    );
});

const loginCafeAdmin = asyncHandler(async (req, res) => {
  const { email, password, phoneNumber } = req.body;

  if (!(email || phoneNumber)) {
    throw new ApiError(
      400,
      "at least one field is required from email or phone number"
    );
  }
  const cafeCheeck = await CafeAdmin.findOne({
    $or: [{ email }, { phoneNumber }],
  });
  if (!password) throw new ApiError(400, "password must required");
  if (!cafeCheeck)
    throw new ApiError(
      400,
      "no user found regarding this email and phone number"
    );
  const checkpassword = await cafeCheeck.isPasswordCorrect(password);
  if (!checkpassword) throw new ApiError(400, "invalid credentials");
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    cafeCheeck._id,
    CafeAdmin
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(200, cafeCheeck, "cafe admin successfully logged in")
    );
});

const logoutCafeAdmin = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await CafeAdmin.findById(userId);
  if (!user)
    throw new ApiError(400, "user wasn't able to found , regarding this token");
  await CafeAdmin.findByIdAndUpdate(
    user._id,
    {
      $unset: { refreshToken: "" },
    },
    {
      new: true,
    }
  );

  return res
  .status(200)
  .clearCookie("accessToken",options)
  .clearCookie("refreshToken",options)
  .json(
    new ApiResponse(
        200,
        {},
        "cafe admin staff sucessfully logged out"
    )
  )
});

const fetchAllCafeAdmin = asyncHandler(async(req,res) => {
  const cafeAdmins = await CafeAdmin.find({}).select("-refreshToken -password"); // need to undo password only if required to get password visible to admin
  

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      cafeAdmins,
      "successfully fetched all cafe admins"
    )
  )

})

const destroyCafeAdmin = asyncHandler(async(req,res) => {
  const admin = await CafeAdmin.findByIdAndDelete(req.params.id);
  if(!admin) throw new ApiError(400,"error occoured while deleting cafe admin staff");

  return res
  .status(200)
  .json(
    200,
    admin,
    "cafe admin staff successfully destroyed"
  )

})

export { addCafeAdmin, loginCafeAdmin ,logoutCafeAdmin,fetchAllCafeAdmin,destroyCafeAdmin};
