import { Router } from "express";
import { loginTrainier, logOutTrainer } from "../controllers/trainer.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

import {
  generateDiet,
  approveDiet,
  getMyDiet,
} from "../controllers/diet.controllers.js";

import { isTrainer } from "../middlewares/isTrainer.middlewares.js";

const router = Router();

router.route("/login").post(loginTrainier)
router.route("/logout").post(verifyJWT,logOutTrainer)


// Trainer / Admin
router.post("/diet/generate", verifyJWT, 
    isTrainer,
     generateDiet);
router.patch("/diet/approve/:dietId", verifyJWT,
    isTrainer,
    approveDiet);

// User
// router.get("/diet/my", verifyJWT, getMyDiet); // gotta put that on user file , after final confoermation 




export default router