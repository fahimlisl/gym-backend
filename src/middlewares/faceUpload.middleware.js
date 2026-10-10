import multer from "multer";
import { ApiError } from "../utils/ApiError.js";

export const faceUpload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },

  fileFilter: (req, file, callback) => {
    if (
      !["image/jpeg", "image/png"].includes(file.mimetype)
    ) {
      return callback(
        new ApiError(
          400,
          "Only JPEG or PNG face images are allowed."
        )
      );
    }

    callback(null, true);
  },
});