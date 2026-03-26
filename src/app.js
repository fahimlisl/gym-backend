import express, { json } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import adminRouter from "./routes/admin.routes.js"
import userRouter from "./routes/user.routes.js"
import generalRouter from "./routes/general.routes.js"
import trainerRouter from "./routes/trainer.routes.js"
import cafeAdminRouter from "./routes/cafeAdmin.routes.js"
import paymentRoutes from "./routes/payment.routes.js"


const app = express();

app.use(cors({
    // origin:process.env.CORS_ORIGIN,
    origin:"http://localhost:5173",
    credentials:true
}))

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  message: { error: "Too many requests, please try again later." }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, 
});
app.use(morgan("combined"))
app.use(express.urlencoded({limit:"16kb",extended:true}))
app.use(express.json({limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser());
app.use(helmet());

// routes
// app.use("/api/v1", limiter);
// app.use("/api/v1/user/login", authLimiter);
// app.use("/api/v1/admin/login", authLimiter);

app.use("/api/v1/admin",adminRouter)
app.use("/api/v1/user",userRouter)
app.use("/api/v1/general",generalRouter)
app.use("/api/v1/trainer",trainerRouter)
app.use("/api/v1/cafe/admin",cafeAdminRouter)
app.use("/api/v1/payment",paymentRoutes)


export default app;