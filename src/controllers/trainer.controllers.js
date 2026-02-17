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

const loginTrainier = asyncHandler(async (req, res) => {
  const { email, phoneNumber, password } = req.body;
  if (!(email || phoneNumber)) {
    throw new ApiError(400, "email or phone number required");
  }
  const check = await Trainer.findOne({
    $or: [{ email }, { phoneNumber }],
  });
  if (!check) {
    throw new ApiError(400, "trainer wasn't able to found");
  }
  if (!password) {
    throw new ApiError(400, "password must requied");
  }
  const checkPassword = await check.isPasswordCorrect(password);

  if (!checkPassword) {
    throw new ApiError(400, "password didn't match , invalid crednetials");
  }
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    check._id,
    Trainer
  );

  return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(new ApiResponse(200, check, "trainer logged in successfully"));
});

const logOutTrainer = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (!userId) {
    throw new ApiError(
      400,
      "userId wasn't able to found , unauthroized access"
    );
  }
  const user = await Trainer.findById(req.user._id);
  if (!user) {
    throw new ApiError(
      400,
      "user isn't logged in yet , or unauthorized access"
    );
  }
  await Trainer.findByIdAndUpdate(
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

const changePassword = asyncHandler(async(req,res) => {
  const {oldPassword,newPassword,confirmNewPassword} = req.body;
  const userId = req.user._id;
  if([oldPassword,newPassword,confirmNewPassword].some((t) => t?.trim() === "")){
    throw new ApiError(400,"all feilds are required!");
  }
  const user = await Trainer.findById(userId);
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

export { logOutTrainer, loginTrainier, registerTrainer ,changePassword};
export {
  editTrainer,
  destroyTrainer,
  fetchAllTrainer,
  fetchParticularTrainer,
  fetchAssignedStudents,
};