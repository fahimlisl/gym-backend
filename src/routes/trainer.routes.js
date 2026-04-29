import { Router } from "express";
import { fetchAssignedStudents, fetchParticularTrainer, loginTrainier, logOutTrainer } from "../controllers/trainer.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

import { isTrainer } from "../middlewares/isTrainer.middlewares.js";
import { addFood, getAllFoods } from "../controllers/food.controllers.js";
import {upload} from "../middlewares/multer.middlewares.js"
import { generateresetPasswordToken , validateOTPandChangePassword } from "../service/reset.service.js"
import { Trainer } from "../models/trainer.models.js";
import { changePassword } from "../service/change.password.service.js";
import { getMyQR, getTodayAttendance } from "../controllers/attendence.controllers.js";
import { getUserWorkout } from "../controllers/assignedWorkout.controllers.js";
import { fetchAllUser } from "../controllers/user.controllers.js";
import { getMyAttendance, getSingleTrainerMonthlyAttendance, getTrainerQR, markTrainerAttendanceByGymQR } from "../controllers/trainerAttendance.controllers.js";
import { fetchCouponForTrainerSelf } from "../controllers/trainercoupon.controllers.js";

const router = Router();

router.route("/login").post(loginTrainier)
router.route("/logout").post(verifyJWT,logOutTrainer)
router.route("/change/password").patch(verifyJWT,isTrainer,changePassword(Trainer))
router.route("/reset/password/token").post(generateresetPasswordToken(Trainer))
router.route("/reset/password").post(validateOTPandChangePassword(Trainer))


router.route("/fetchSelf").get(verifyJWT,isTrainer,fetchParticularTrainer)
router.route("/fetch/self/coupon").get(verifyJWT,isTrainer,fetchCouponForTrainerSelf)


// food

router.route("/getAllFoods").get(verifyJWT,isTrainer,getAllFoods)


router.route("/attendance/my-qr").get( verifyJWT, getTrainerQR);

router.route("/today/attendence").get(verifyJWT,isTrainer,getTodayAttendance)
router.route("/attendance/trainer/:trainerId/month").get(verifyJWT,isTrainer,getSingleTrainerMonthlyAttendance)
router.route("/attendance/trainer/my").get(verifyJWT,isTrainer,getMyAttendance)
router.post("/attendance/trainer/gym-qr", verifyJWT, isTrainer, markTrainerAttendanceByGymQR)

// fetch Students
router.get('/user/:userId/workout', verifyJWT, isTrainer, getUserWorkout)
router.route("/fetchAllUser").get(verifyJWT, isTrainer, fetchAllUser);
router.route("/fetchAssignedStudents").get(verifyJWT,isTrainer,fetchAssignedStudents)

export default router