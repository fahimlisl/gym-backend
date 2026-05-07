import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

const isSuperAdmin = asyncHandler(async (req, res, next) => {
  if (!req.user?.isSuperAdmin) {
    throw new ApiError(403, "Super admin access required");
  }
  next();
});

export {isSuperAdmin}