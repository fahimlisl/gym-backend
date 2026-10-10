
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import path from "node:path";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

// routes 
import adminRouter from "./routes/admin.routes.js";
import userRouter from "./routes/user.routes.js";
import generalRouter from "./routes/general.routes.js";
import trainerRouter from "./routes/trainer.routes.js";
import cafeAdminRouter from "./routes/cafeAdmin.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import whatsAppRoutes from "./routes/whatsapp.routes.js";

const app = express();

const require = createRequire(import.meta.url);


const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
);

if (allowedOrigins.size === 0) {
  throw new Error("CORS_ALLOWED_ORIGINS is missing");
}

app.use(cors({
  origin: (origin, callback) => {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  credentials: true,
}));


app.use(helmet());
app.use(morgan("combined"));
app.use(
  express.urlencoded({
    limit: "16kb",
    extended: true,
  })
);
app.use(
  express.json({
    limit: "16kb",
  })
);
app.use(cookieParser());
app.use(express.static("public"));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,

  message: {
    error:
      "Too many requests, please try again later.",
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
});

// Rate limiting is configured but not enabled.
// app.use("/api/v1", limiter);
// app.use("/api/v1/user/login", authLimiter);
// app.use("/api/v1/admin/login", authLimiter);

const humanEntry = require.resolve(
  "@vladmandic/human"
);

const humanModelsDirectory = path.resolve(
  path.dirname(humanEntry),
  "../models"
);
if (!existsSync(humanModelsDirectory)) {
  console.error(
    "[FACE] Human.js model directory not found:",
    humanModelsDirectory
  );
} else {
  console.log(
    "[FACE] Human.js model directory:",
    humanModelsDirectory
  );
}

app.use(
  "/face-models",
  express.static(humanModelsDirectory, {
    index: false,
    dotfiles: "deny",
    fallthrough: true,
  })
);


app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/general", generalRouter);
app.use("/api/v1/trainer", trainerRouter);
app.use("/api/v1/cafe/admin", cafeAdminRouter);
app.use("/api/v1/payment", paymentRoutes);
app.use("/api/v1/whatsapp", whatsAppRoutes);

export default app;