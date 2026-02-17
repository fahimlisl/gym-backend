import { Router } from "express";
import { changePassword, fetchAssignedStudents, fetchParticularTrainer, loginTrainier, logOutTrainer } from "../controllers/trainer.controllers.js";
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
  createMeal,
  removeMeal,
} from "../controllers/diet.controllers.js";

import { isTrainer } from "../middlewares/isTrainer.middlewares.js";
import { addFood, getAllFoods } from "../controllers/food.controllers.js";
import {upload} from "../middlewares/multer.middlewares.js"
import { generateresetPasswordToken , validateOTPandChangePassword } from "../service/reset.service.js"
import { Trainer } from "../models/trainer.models.js";

const router = Router();

router.route("/login").post(loginTrainier)
router.route("/logout").post(verifyJWT,logOutTrainer)
router.route("/change/password").patch(verifyJWT,isTrainer,changePassword)
router.route("/reset/password/token").post(generateresetPasswordToken(Trainer))
router.route("/reset/password").post(validateOTPandChangePassword(Trainer))


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
router.route("/addFood/:mealId").post(verifyJWT,isTrainer,foodItemInserction)
router.route("/diet/show/:id").get(verifyJWT,isTrainer,showParticularDiet)
router.route("/diet/check/:id").get(verifyJWT,isTrainer,checkIfDietExists)
router.route("/diet/check/status/:id").get(verifyJWT,isTrainer,approveCheck)
router.route("/diet/:userId/food/remove/:foodId/:mealId").patch(verifyJWT,isTrainer,removeItemFromDiet)
router.route("/diet/add/meal/:id").patch(verifyJWT,isTrainer,createMeal)
router.route("/diet/remove/meal/:mealId/:dietId").patch(verifyJWT,isTrainer,removeMeal)


// user 
// router.post(
//   "/register",
//   verifyJWT,
//   isTrainer, 
//   upload.single("avatar"), 
//   registerUser
// );


export default router