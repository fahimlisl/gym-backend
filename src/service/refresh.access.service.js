import jwt from "jsonwebtoken";

import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import generateAccessAndRefreshToken from "../utils/generateANR.js";
import { accessCookieOptions, refreshCookieOptions } from "../utils/authCookies.js";

export const refreshAccessToken = (Model) =>
  asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;
    if (!incomingRefreshToken) {
      throw new ApiError(
        401,
        "Refresh token missing. Please login again."
      );
    }
    let decodedToken;
    try {
      decodedToken = jwt.verify(
        incomingRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );
    } catch (error) {
      throw new ApiError(
        401,
        "Refresh token expired or invalid. Please login again."
      );
    }

    const user = await Model.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Account not found.");
    }
    if (
      !user.refreshToken ||
      user.refreshToken !== incomingRefreshToken
    ) {
      throw new ApiError(
        401,
        "Refresh token is no longer valid."
      );
    }

    /*
      IMPORTANT:
      generateAccessAndRefreshToken()
      should save the NEW refreshToken into DB.

      That gives you refresh-token rotation.
    */
    const {
      accessToken,
      refreshToken,
    } = await generateAccessAndRefreshToken(
      user._id,
      Model
    );

    return res
      .status(200)
      .cookie(
        "accessToken",
        accessToken,
        accessCookieOptions
      )
      .cookie(
        "refreshToken",
        refreshToken,
        refreshCookieOptions
      )
      .json(
        new ApiResponse(
          200,
          {},
          "Access token refreshed successfully"
        )
      );
  });