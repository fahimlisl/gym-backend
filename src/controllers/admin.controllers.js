import { Admin } from "../models/admin.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import generateAccessAndRefreshToken from "../utils/generateANR.js";
import mongoose from "mongoose";
import { generateReferenceFaceEmbedding } from "../service/faceRecognition.service.js";
import { Trainer } from "../models/trainer.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { accessCookieOptions, refreshCookieOptions } from "../utils/authCookies.js";
import { v2 as cloudinary } from "cloudinary";
import { createHash } from "node:crypto";

const registerAdmin = asyncHandler(async (req, res) => {
  const { username, email, password, phoneNumber ,isSuperAdmin} = req.body;

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
    isSuperAdmin:false
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

  res.cookie("accessToken", accessToken, accessCookieOptions);
  res.cookie("refreshToken", refreshToken, refreshCookieOptions);

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

  res.clearCookie("accessToken",accessCookieOptions);

  res.clearCookie("refreshToken",refreshCookieOptions);

  return res.status(200).json({
    success: true,
    message: "Admin logged out successfully",
  });
});


const getAdminProfile = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.user._id).select("-password -refreshToken");

  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  return res.status(200).json({
    success: true,
    message: "Admin profile retrieved successfully",
    admin,
  });
});
export const getAAdmin = asyncHandler(async (req, res) => {
  const admin = await Admin.findById(req.params._id)

  if (!admin) {
    throw new ApiError(404, "Admin not found");
  }

  return res.status(200).json({
    success: true,
    message: "Admin profile retrieved successfully",
    admin,
  });
});


const ALLOWED_PERMISSIONS = [
  "members", "payments", "trainer", "attendance", "plans", "offers",
  "supplement", "sell_supplement", "coupons", "trainer_coupon",
  "expense", "assets", "check_in_qr", "workout_templates", "payments_in" , "all_payments" , "cafe_payments","cafe_all_items","cafe_admins","can_assign_workout","can_renew","can_assign_diet","can_change_trainer"
];

const ALLOWED_FIELDS = ["allow", "isReadOnly"];

// for toggle permissiona and remove admin secutiry check is done by isSuperAdmin middleware via route

const togglePermission = asyncHandler(async (req, res) => {
  const { permission, adminId } = req.params;
  const { field } = req.query; // "allow" | "isReadOnly"

  if (!ALLOWED_PERMISSIONS.includes(permission)) {
    throw new ApiError(400, "Invalid permission module");
  }
  if (!ALLOWED_FIELDS.includes(field)) {
    throw new ApiError(400, "field query param must be 'allow' or 'isReadOnly'");
  }

  const targetAdmin = await Admin.findById(adminId);
  if (!targetAdmin) {
    throw new ApiError(404, "Admin not found");
  }
  if (targetAdmin.isSuperAdmin) {
    throw new ApiError(400, "Cannot modify a super admin's permissions");
  }

  const fieldPath = `${permission}.${field}`;

  const updatedAdmin = await Admin.findByIdAndUpdate(
    adminId,
    [{ $set: { [fieldPath]: { $not: [`$${fieldPath}`] } } }],
    { new: true, updatePipeline: true } 
  ).select("-password -refreshToken -resetPasswordToken");

  return res
    .status(200)
    .json(new ApiResponse(200, updatedAdmin, `${permission}.${field} toggled`));
});

const fetchAllNonSuperAdmins = asyncHandler(async (req, res) => {
  const admins = await Admin.find({ isSuperAdmin: false })
    .select("-password -refreshToken -resetPasswordToken")
    .sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, admins, "Admins fetched"));
});


const removeAdmin = asyncHandler(async(req,res) => {
  const adminId = req.params.adminId;
  const admin = await Admin.findByIdAndDelete(adminId)
  if(!admin) {
    throw new ApiError(404,"admin didn't found to delete");
  }

  return res
  .status(200)
  .json(
    new ApiResponse(200,{},`${admin?.username} admin deleted successfully`)
  )
})


// admin controller for verified avatar upload of trainer


const removeCloudinaryPhotos = async (photos) => {
  const results = await Promise.allSettled(
    photos
      .filter((photo) => photo?.public_id)
      .map((photo) =>
        cloudinary.uploader.destroy(photo.public_id)
      )
  );

  for (const result of results) {
    if (result.status === "rejected") {
      console.error(
        "[ENROLLMENT] Cloudinary cleanup failed:",
        result.reason
      );
    }
  }
};

export const uploadTrainerVerificationAvatar = asyncHandler(
  async (req, res) => {
    const { trainerId } = req.params;
    const files = req.files ?? [];

    if (!mongoose.isValidObjectId(trainerId)) {
      throw new ApiError(400, "Invalid trainer ID.");
    }

    if (files.length < 3 || files.length > 5) {
      throw new ApiError(
        400,
        "Upload between 3 and 5 reference photos."
      );
    }

    const trainer = await Trainer.findById(trainerId);

    if (!trainer) {
      throw new ApiError(404, "Trainer not found.");
    }

    const hashes = files.map((file) =>
      createHash("sha256")
        .update(file.buffer)
        .digest("hex")
    );

    if (new Set(hashes).size !== files.length) {
      throw new ApiError(
        400,
        "Duplicate reference photos are not allowed."
      );
    }

    const embeddings = [];

    for (const file of files) {
      const faceData =
        await generateReferenceFaceEmbedding(
          file.buffer
        );

      if (
        !Array.isArray(faceData.embedding) ||
        faceData.embedding.length === 0 ||
        !faceData.embedding.every(Number.isFinite)
      ) {
        throw new ApiError(
          400,
          "Unable to process one of the reference photos."
        );
      }

      embeddings.push(faceData.embedding);
    }

    const expectedLength = embeddings[0].length;

    if (
      !embeddings.every(
        (embedding) =>
          embedding.length === expectedLength
      )
    ) {
      throw new ApiError(
        400,
        "Reference embeddings have incompatible dimensions."
      );
    }

    const oldPhotos =
      trainer.verificationPhotos?.length
        ? trainer.verificationPhotos.map((photo) => ({
            url: photo.url,
            public_id: photo.public_id,
          }))
        : trainer.verificationAvatar?.public_id
          ? [{
              url: trainer.verificationAvatar.url,
              public_id:
                trainer.verificationAvatar.public_id,
            }]
          : [];

    const uploadedPhotos = [];

    try {
      // Store every actual image in Cloudinary.
      for (const file of files) {
        const uploaded = await uploadOnCloudinary(
          file.buffer
        );

        if (!uploaded?.url || !uploaded?.public_id) {
          throw new ApiError(
            500,
            "Failed to upload one of the reference photos."
          );
        }

        uploadedPhotos.push({
          url: uploaded.url,
          public_id: uploaded.public_id,
        });
      }

      // Save all five images and all five embeddings.
      trainer.verificationPhotos = uploadedPhotos;

      // Legacy compatibility.
      trainer.verificationAvatar = uploadedPhotos[0];
      trainer.faceEmbedding = embeddings[0];

      // Multi-reference recognition.
      trainer.faceEmbeddings = embeddings;

      await trainer.save();
    } catch (error) {
      // Only newly uploaded images are removed if saving fails.
      await removeCloudinaryPhotos(uploadedPhotos);

      throw error;
    }

    // Delete old photos only after MongoDB saves successfully.
    await removeCloudinaryPhotos(oldPhotos);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          trainerId: trainer._id,
          verificationAvatar: trainer.verificationAvatar,
          referenceCount: embeddings.length,
          photoCount: uploadedPhotos.length,
          faceEnrolled: true,
        },
        "Trainer face enrollment updated successfully."
      )
    );
  }
);


export const getTrainerVerificationPhotos = asyncHandler(
  async (req, res) => {
    const { trainerId } = req.params;

    if (!mongoose.isValidObjectId(trainerId)) {
      throw new ApiError(400, "Invalid trainer ID.");
    }

    const trainer = await Trainer.findById(trainerId)
      .select("verificationPhotos verificationAvatar")
      .lean();

    if (!trainer) {
      throw new ApiError(404, "Trainer not found.");
    }

    const photos = trainer.verificationPhotos?.length
      ? trainer.verificationPhotos
      : trainer.verificationAvatar?.url
        ? [trainer.verificationAvatar]
        : [];

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          photos: photos.map((photo) => ({
            url: photo.url,
            public_id: photo.public_id,
          })),
          count: photos.length,
        },
        "Trainer verification photos fetched."
      )
    );
  }
);




export { registerAdmin, loginAdmin, logOutAdmin , getAdminProfile , togglePermission,fetchAllNonSuperAdmins,removeAdmin};