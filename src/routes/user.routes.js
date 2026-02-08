import { Router } from "express";
import {upload} from "../middlewares/multer.middlewares.js"
import { fetchParticularUser, fetchProfile, loginUser, logOutUser, registerUser } from "../controllers/user.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

import {approveCheck, getMyDiet} from "../controllers/diet.controllers.js"
const router = Router();



router.route("/register").post(
    upload.single("avatar"),
    registerUser
)
router.route("/login").post(loginUser)
router.route("/logout").post(verifyJWT,logOutUser)
router.route("/getProfile").get(verifyJWT,fetchProfile)


// diet
router.route("/diet/check/status/:id").get(verifyJWT,approveCheck)
router.route("/diet/my").get(verifyJWT,getMyDiet)

export default router;