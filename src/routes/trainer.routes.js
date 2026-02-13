import { Router } from "express";
import { fetchAssignedStudents, fetchParticularTrainer, loginTrainier, logOutTrainer } from "../controllers/trainer.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";

import {
  generateDiet,
  approveDiet,
  getMyDiet,
  foodItemInserction,
  showParticularDiet,
  checkIfDietExists,
  approveCheck,
  setDietMacros,
  removeItemFromDiet,
} from "../controllers/diet.controllers.js";

import { isTrainer } from "../middlewares/isTrainer.middlewares.js";
import { addFood, getAllFoods } from "../controllers/food.controllers.js";
import {upload} from "../middlewares/multer.middlewares.js"

const router = Router();

router.route("/login").post(loginTrainier)
router.route("/logout").post(verifyJWT,logOutTrainer)


// Trainer / Admin
router.post("/diet/generate", verifyJWT, 
    isTrainer,
     generateDiet);
router.route("/diet/setMacros/:id").patch(verifyJWT,isTrainer,setDietMacros)

router.patch("/diet/approve/:dietId", verifyJWT,
    isTrainer,
    approveDiet);

// User
// router.get("/diet/my", verifyJWT, getMyDiet); // gotta put that on user file , after final confoermation 

router.route("/fetchAssignedStudents").get(verifyJWT,isTrainer,fetchAssignedStudents)
router.route("/fetchSelf").get(verifyJWT,isTrainer,fetchParticularTrainer)


// food

router.route("/getAllFoods").get(verifyJWT,isTrainer,getAllFoods)


// diet kinda thigns 

router.route("/addFoodtoDB").post(verifyJWT,isTrainer,addFood)
router.route("/addFood").post(verifyJWT,isTrainer,foodItemInserction)
router.route("/diet/show/:id").get(verifyJWT,isTrainer,showParticularDiet)
router.route("/diet/check/:id").get(verifyJWT,isTrainer,checkIfDietExists)
router.route("/diet/check/status/:id").get(verifyJWT,isTrainer,approveCheck)
router.route("/diet/:userId/food/remove/:foodId").patch(verifyJWT,isTrainer,removeItemFromDiet)


// user 
// router.post(
//   "/register",
//   verifyJWT,
//   isTrainer, 
//   upload.single("avatar"), 
//   registerUser
// );


export default router