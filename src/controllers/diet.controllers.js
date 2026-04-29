import { Diet } from "../models/diet.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { User } from "../models/user.models.js";
import {
  uploadOnCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinary.js";

const generateDiet = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    throw new ApiError(400, "User ID is required");
  }
  if (!req.files || req.files.length === 0) {
    throw new ApiError(400, "At least one photo or PDF is required");
  }
  const photos = [];
  try {
    for (const file of req.files) {
      const uploadResult = await uploadOnCloudinary(file.buffer);
      photos.push({
        photo: uploadResult.url,
        public_id: uploadResult.public_id,
      });
    }
  } catch (error) {
    throw new ApiError(500, `Failed to upload files: ${error.message}`);
  }

  const diet = await Diet.create({
    user: userId,
    photos,
    status: "draft",
  });

  const updated = await User.findByIdAndUpdate(
    userId,
    { $set: { diet: diet._id } },
    { new: true }
  );

  if (!updated) {
    throw new ApiError(400, "Failed to link diet to user");
  }

  return res
    .status(201)
    .json(new ApiResponse(201, diet, "Diet created with photos/PDFs (draft)"));
});

const approveDiet = asyncHandler(async (req, res) => {
  const { dietId } = req.params;
  const status = req.body?.status || "approved";

  const diet = await Diet.findByIdAndUpdate(dietId, { status }, { new: true });

  if (!diet) throw new ApiError(404, "Diet not found");

  const message =
    status === "draft"
      ? "Diet unlocked for editing"
      : "Diet approved successfully";

  res.json(new ApiResponse(200, diet, message));
});

const editDiet = asyncHandler(async (req, res) => {
  const { dietId } = req.params;
  const { filesToRemove } = req.body;

  const diet = await Diet.findById(dietId);
  if (!diet) throw new ApiError(404, "Diet not found");

  if (diet.status !== "draft") {
    throw new ApiError(400, "Can only edit diets in draft status");
  }

  console.log("filesToRemove from request body is ", filesToRemove);
  let indicesToRemove = [];
  if (filesToRemove) {
    try {
      indicesToRemove =
        typeof filesToRemove === "string"
          ? JSON.parse(filesToRemove)
          : filesToRemove;
    } catch (error) {
      indicesToRemove = [];
    }
  }
  console.log("indices to remove are ", indicesToRemove);

  const photosToDelete = indicesToRemove
    .map((index) => diet.photos[index])
    .filter(Boolean);
  try {
    console.log("photos to delete are ", photosToDelete);
    console.log("line 101 , diet.contoller.js")
    for (const photo of photosToDelete) {
      if (photo.public_id) {
        console.log("public id is ", photo.public_id);
        const res = await deleteFromCloudinary(photo.public_id);
        console.log("delete result is ", res);
      }
    }
  } catch (error) {
    console.error("Error deleting old photos:", error);
  }

  let updatedPhotos = diet.photos.filter(
    (_, index) => !indicesToRemove.includes(index)
  );

  if (req.files && req.files.length > 0) {
    try {
      for (const file of req.files) {
        const uploadResult = await uploadOnCloudinary(file.buffer);
        console.log("result is ",uploadResult)
        updatedPhotos.push({
          photo: uploadResult.url,
          public_id: uploadResult.public_id,
        });
      }
    } catch (error) {
      throw new ApiError(500, `Failed to upload files: ${error.message}`);
    }
  }

  if (updatedPhotos.length === 0) {
    throw new ApiError(400, "Diet must have at least one photo or PDF");
  }

  const updatedDiet = await Diet.findByIdAndUpdate(
    dietId,
    { photos: updatedPhotos },
    { new: true }
  );

  return res.json(
    new ApiResponse(200, updatedDiet, "Diet updated successfully")
  );
});

const getMyDiet = asyncHandler(async (req, res) => {
  const diet = await Diet.findOne({
    user: req.user._id,
    status: "approved",
  }).sort({ createdAt: -1 });

  if (!diet) throw new ApiError(404, "No approved diet found");

  res.json(new ApiResponse(200, diet, "Diet fetched successfully"));
});

const checkIfDietExists = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const diet = await Diet.findOne({ user: userId }).select("_id status");

  if (!diet) {
    return res
      .status(200)
      .json(
        new ApiResponse(200, { exists: false }, "No diet found for this user")
      );
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { exists: true, dietId: diet._id, status: diet.status },
        "Diet exists"
      )
    );
});

const showParticularDiet = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const diet = await Diet.findOne({ user: userId });

  if (!diet) throw new ApiError(400, "Diet not created yet");

  return res
    .status(200)
    .json(new ApiResponse(200, diet, "Diet fetched successfully"));
});

const approveCheck = asyncHandler(async (req, res) => {
  const dietId = req.params.id;
  const diet = await Diet.findById(dietId);

  if (!diet) throw new ApiError(400, "Diet not found");

  const message =
    diet.status === "approved"
      ? "Diet is approved"
      : "Diet is in draft, awaiting approval";

  return res.status(200).json(new ApiResponse(200, diet.status, message));
});

export {
  showParticularDiet,
  generateDiet,
  approveDiet,
  editDiet,
  getMyDiet,
  checkIfDietExists,
  approveCheck,
};
