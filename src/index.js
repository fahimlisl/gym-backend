import app from "./app.js";
import dotenv from "dotenv"
import { connectDB } from "./db/index.js";
import "./cron/couponExpire.cron.js"; // invoking corn coupon expire ,


dotenv.config({
    path:"./.env"
})

connectDB()
.then(() => {
    app.listen(process.env.PORT || 3030 , () => {
        console.log(`server is listening on port ${process.env.PORT || 3030}`)
    })
})
.catch((err) => {
    console.log(`got error in main src/index.js , error : ${err}`)
    process.exit(0)
})
