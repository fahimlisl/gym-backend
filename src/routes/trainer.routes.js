import { Router } from "express";
import { loginTrainier, logOutTrainer } from "../controllers/trainer.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";


const router = Router();

router.route("/login").post(loginTrainier)
router.route("/logout").post(verifyJWT,logOutTrainer)

export default router