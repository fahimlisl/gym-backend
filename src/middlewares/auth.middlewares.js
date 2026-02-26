import jwt from "jsonwebtoken";
import { Admin } from "../models/admin.models.js";
import { User } from "../models/user.models.js";
import { Trainer } from "../models/trainer.models.js";
import { CafeAdmin } from "../models/cafeAdmin.models.js";
import { ApiError } from "../utils/ApiError.js";

const roleMap = {
  admin: Admin,
  user: User,
  trainer: Trainer,
  cafeAdmin: CafeAdmin,
};

// verify JWT is modificed so that it can accept headers and can act as hybird system.

export const verifyJWT = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token && req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access - No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    const Model = roleMap[decoded.role];
    if (!Model) {
      return res.status(401).json({
        success: false,
        message: "Invalid role in token",
      });
    }

    const user = await Model.findById(decoded._id).select(
      "-password -refreshToken"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    req.user = user;
    req.role = decoded.role;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};