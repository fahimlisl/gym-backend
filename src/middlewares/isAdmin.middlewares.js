import { ApiError } from "../utils/ApiError.js";

export const isAdmin = (req, _, next) => {
  if (req.role !== "admin") {
    throw new ApiError(403, "Admin access only");
  }
  next();
};
