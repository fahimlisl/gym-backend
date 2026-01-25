import express, { json } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";



const app = express();

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credentials:true
}))

app.use(morgan("combined"))
app.use(express.urlencoded({limit:"16kb",extended:true}))
app.use(express.json({limit:"16kb"}))
app.use(express.static("public"))
app.use(cookieParser());


import adminRouter from "./routes/admin.routes.js"
import userRouter from "./routes/user.routes.js"
import generalRouter from "./routes/general.routes.js"

// routes

app.use("/api/v1/admin",adminRouter)
app.use("/api/v1/user",userRouter)
app.use("/api/v1/general",generalRouter)


export default app