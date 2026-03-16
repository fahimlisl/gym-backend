import { ApiError } from "../utils/ApiError.js";

export const isUser = (req, _, next) => {
  if (req.role !== "user") {
    throw new ApiError(403, "Member access only");
  }
  next();
};
