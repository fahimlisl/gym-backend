import { Trainer } from "../models/trainer.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import generateAccessAndRefreshToken from "../utils/generateANR.js";
import { options } from "../utils/options.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { User } from "../models/user.models.js";
import axios from "axios";

const registerTrainer = asyncHandler(async (req, res) => {
  const { fullName, email, phoneNumber, experience, salary } =
    req.body;
  if (
    [fullName, phoneNumber, experience, salary].some(
      (t) => !t && t !== 0
    )
  ) {
    throw new ApiError(400, "each field is required");
  }

  const check = await Trainer.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (check)
    throw new ApiError(
      400,
      "trainier already exists vai same phone number or email id"
    );

  const avatar = req.file.buffer;
  if (!avatar) throw new ApiError(400, "avatar must required");

  const avatarOnCloud = await uploadOnCloudinary(avatar);
  if (!avatarOnCloud)
    throw new ApiError(400, "avatar wasn't able to upload on cloudianry");

    const generateDefaultPassword = (username) => {
  if (!username) return null;
  const cleanName = username.trim().replace(/\s+/g, "");

  const firstThree = cleanName.slice(0, 3).toLowerCase();

  const randomThree = Math.floor(100 + Math.random() * 900);

  return firstThree + randomThree;
};

const defaultPassword = generateDefaultPassword(fullName)



  const trainer = await Trainer.create({
    fullName,
    email,
    phoneNumber,
    password:defaultPassword,
    experience,
    avatar: {
      url: avatarOnCloud.url,
      public_id: avatarOnCloud.public_id,
    },
    salary,
  });
  if (!trainer)
    throw new ApiError(
      500,
      "internal server erorr , wasn't able to create trainer"
    );

    try {
    await axios.post(process.env.N8N_WEBHOOK_URL, {
      eventType: "new_trainer",
      memberName: fullName,
      email: email || '',
      phoneNumber: phoneNumber,
      password:defaultPassword
    });
  } catch (error) {
    console.error('Failed to trigger n8n webhook:', error);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, trainer, "trainer created successfully"));
});


const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
};

const loginTrainier = asyncHandler(async (req, res) => {
  const { email, phoneNumber, password } = req.body;

  if (!(email || phoneNumber)) {
    throw new ApiError(400, "Email or phone number required");
  }

  if (!password) {
    throw new ApiError(400, "Password required");
  }

  const trainer = await Trainer.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (!trainer) {
    throw new ApiError(401, "Trainer not found");
  }

  const isMatch = await trainer.isPasswordCorrect(password);

  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } =
    await generateAccessAndRefreshToken(trainer._id, Trainer);

  const safeTrainer = await Trainer.findById(trainer._id).select(
    "-password -refreshToken"
  );

  res.cookie("accessToken", accessToken, cookieOptions);
  res.cookie("refreshToken", refreshToken, cookieOptions);

  return res.status(200).json({
    success: true,
    message: "Trainer logged in successfully",
    user: safeTrainer,
    accessToken,
    refreshToken,
  });
});

const logOutTrainer = asyncHandler(async (req, res) => {
  await Trainer.findByIdAndUpdate(req.user._id, {
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
    message: "Trainer logged out successfully",
  });
});


const editTrainer = asyncHandler(async (req, res) => {
  const { fullName, email, phoneNumber, experience, salary } = req.body;
  const trainerId = req.params.id;
  if (!(fullName || email || phoneNumber || experience || salary)) {
    throw new ApiError(400, "at least one field is required");
  }

  const check = await Trainer.findById(trainerId);
  if (!check) {
    throw new ApiError(400, "trainer wasn't able to found");
  }
  const update = await Trainer.findByIdAndUpdate(
    check._id,
    {
      $set: {
        fullName: fullName || check.fullName,
        email: email || check.email,
        phoneNumber: phoneNumber || check.phoneNumber,
        experience: experience || check.experience,
        salary: salary || check.salary,
      },
    },
    {
      new: true,
    }
  );

  if (!update) {
    throw new ApiError(500, "internal server error , failed to updatetrainer");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        update,
        "trainer deatils have been updated successfully"
      )
    );
});

const destroyTrainer = asyncHandler(async (req, res) => {
  const trainerId = req.params.id;
  const del = await Trainer.findByIdAndDelete(trainerId);
  if (!del) {
    throw new ApiError(400, "failed to delete trianer");
  }

  const delAvatar = await deleteFromCloudinary(del.avatar.public_id);
  if (!delAvatar) {
    throw new ApiError(400, "failed to delete avatar of trainer");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "trainer have been successfully deleted"));
});

const fetchAllTrainer = asyncHandler(async (req, res) => {
  const trainers = await Trainer.find({}).select("-password -refreshToken");
  if (!trainers) {
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "no trainers been added yet"));
  }
  return res
    .status(200)
    .json(new ApiResponse(200, trainers, "trainers been successfully fetched"));
});

const fetchParticularTrainer = asyncHandler(async (req, res) => {
  const trainerId = req.params.id;
  const trainer = await Trainer.findById(trainerId).select(
    "-password -refreshToken"
  );
  if (!trainer)
    throw new ApiError(400, "trainer wasn't able to found regarding this id");
  return res
    .status(200)
    .json(new ApiResponse(200, trainer, "trainer fetched successfully"));
});

const fetchAssignedStudents = asyncHandler(async (req, res) => {
  const trainerId = req.user._id;

  const trainer = await Trainer.findById(trainerId).lean();
  if (!trainer) {
    throw new ApiError(404, "Trainer not found");
  }

  const studentIds = trainer.students.map((s) => s.student.toString());

  const uniqueStudentIds = [...new Set(studentIds)];

  const students = await User.find({
    _id: { $in: uniqueStudentIds },
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        students,
        "Successfully fetched unique assigned members"
      )
    );
});


export { logOutTrainer, loginTrainier, registerTrainer };
export {
  editTrainer,
  destroyTrainer,
  fetchAllTrainer,
  fetchParticularTrainer,
  fetchAssignedStudents,
};