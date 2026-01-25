import { ApiError } from "../utils/ApiError.js";

export const isTrainer = (req, _, next) => {
  if (req.role !== "trainer") {
    throw new ApiError(403, "Trainer access only");
  }
  next();
};
