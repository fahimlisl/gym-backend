import { Router } from "express";
import {
  generateDiet,
  approveDiet,
  getMyDiet,
} from "../controllers/diet.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { isAdmin } from "../middlewares/isAdmin.middleware.js";

const router = Router();

// will be handeled accordingly after conformation
router.post("/diet/generate", verifyJWT, 
    // isAdmin,
     generateDiet);
router.patch("/diet/approve/:dietId", verifyJWT,
    //  isAdmin, 
    approveDiet);

// User
router.get("/diet/my", verifyJWT, getMyDiet);

export default router;
