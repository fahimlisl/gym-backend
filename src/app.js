import express, { json } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";



const app = express();

app.use(cors({
    // origin:process.env.CORS_ORIGIN,
    origin:"http://localhost:5173",
    credentials:true
}))

app.use(morgan("combined"))
app.use(express.urlencoded({limit:"16kb",extended:true}))
app.use(express.json({limit:"16kb"}))
app.use(express.static("public"))
app.use(express.json());
app.use(cookieParser());


import adminRouter from "./routes/admin.routes.js"
import userRouter from "./routes/user.routes.js"
import generalRouter from "./routes/general.routes.js"
import trainerRouter from "./routes/trainer.routes.js"
import cafeAdminRouter from "./routes/cafeAdmin.routes.js"
// routes

app.use("/api/v1/admin",adminRouter)
app.use("/api/v1/user",userRouter)
app.use("/api/v1/general",generalRouter)
app.use("/api/v1/trainer",trainerRouter)
app.use("/api/v1/cafe/admin",cafeAdminRouter)


export default app