import { Router } from "express";
import {upload} from "../middlewares/multer.middlewares.js"
import { fetchParticularUser, fetchProfile, loginUser, logOutUser, registerUser } from "../controllers/user.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { generateresetPasswordToken , validateOTPandChangePassword } from "../service/reset.service.js"
import {approveCheck, getMyDiet} from "../controllers/diet.controllers.js"
import { User } from "../models/user.models.js";
import { changePassword } from "../service/change.password.service.js";
import { checkStatus, generateTempPtbill, getTrainer } from "../controllers/user.ptbill.temp.controllers.js";
import { fetchAllPlans, fetchParticularPlan } from "../controllers/plans.controllers.js";
import { fetchParticularCoupon } from "../controllers/coupon.controllers.js";
const router = Router();



router.route("/register").post(
    upload.single("avatar"),
    registerUser
)
router.route("/login").post(loginUser)
router.route("/logout").post(verifyJWT,logOutUser)
router.route("/getProfile").get(verifyJWT,fetchProfile)
router.route("/change/password").patch(verifyJWT,changePassword(User))
router.route("/reset/password/token").post(generateresetPasswordToken(User))
router.route("/reset/password").post(validateOTPandChangePassword(User))


// diet
router.route("/diet/check/status/:id").get(verifyJWT,approveCheck)
router.route("/diet/my").get(verifyJWT,getMyDiet)

// pt
router.route("/pt/request/:planId").post(verifyJWT,
    upload.single("image"),generateTempPtbill)
router.route("/pt/request/status").get(verifyJWT,checkStatus)
router.route("/pt/assign/trainer/:trainerId").patch(verifyJWT,getTrainer)
router.route("/plans/pt/fetch/all").get(verifyJWT,fetchAllPlans)
router.route("/plans/pt/fetch/:planId").get(verifyJWT,fetchParticularPlan)

router.route("/coupon").post(verifyJWT,fetchParticularCoupon)

export default router;