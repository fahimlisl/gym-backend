
const isProduction = process.env.NODE_ENV === "production";

const baseOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: "lax",
  path: "/",
};

export const accessCookieOptions = {
  ...baseOptions,
  maxAge: 15 * 60 * 1000, // 15 minutes
};

export const refreshCookieOptions = {
  ...baseOptions,
  maxAge: 14 * 24 * 60 * 60 * 1000, // 14 days
};

export const clearCookieOptions = {
  ...baseOptions,
};
