import { Router } from "express";
import {
  loginAdmin,
  logOutAdmin,
  registerAdmin,
} from "../controllers/admin.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import {
  addSupplement,
  destroySupplement,
  editSupplement,
  fetchAllSupp,
  fetchAllSuppBill,
  fetchParticularSupp,
  toggleShipped,
} from "../controllers/supplement.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { isAdmin } from "../middlewares/isAdmin.middlewares.js";
import {
  destroyTrainer,
  editTrainer,
  fetchAllTrainer,
  fetchParticularTrainer,
  registerTrainer,
} from "../controllers/trainer.controllers.js";
import {
  assignPT,
  destroyUser,
  editUser,
  fetchAllUser,
  fetchParticularUser,
  registerUser,
  renewalPtSub,
  renewalSubscription,
} from "../controllers/user.controllers.js";
import {
  calculateTotalInLet,
  fetchAllTransactions,
  fetchDashboardRevenue,
  fetchRecentTransactions,
  fetchRevenueBySource,
} from "../controllers/transaction.controllers.js";
import {
  addCafeAdmin,
  destroyCafeAdmin,
  fetchAllCafeAdmin,
} from "../controllers/cafeAdmin.controllers.js";
import {
  addCafeItem,
  addCateGory,
  destroyCafeItem,
  editCafeItem,
  fetchAllCafeItems,
  fetchEveryCafeOderOfAllStuff,
  fetchParticularCafeItem,
  getCafeCategories,
  toggleAvailabilty,
} from "../controllers/cafeItem.controllers.js";
import {
  createWorkoutTemplate,
  addDayToTemplate,
  addExerciseToDay,
  getTemplate,
  getAdminTemplates,
  updateExercise,
  deleteExercise,
  deleteDay,
  deleteTemplate
} from '../controllers/workout.controllers.js';
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
  editCalories,
} from "../controllers/diet.controllers.js";
import { addCoupon, destroyCoupon, editCoupons, fetchAllCoupons, fetchParticularCoupon, toggleCouponExpire } from "../controllers/coupon.controllers.js";
import { addExpense, fetchAllExpenses, fetchEquipmentsExpenses } from "../controllers/expense.controllers.js";
import { testSubscriptionExpiry } from "../cron/subscriptionExpire.cron.js";
import { getMemberMonthlyAttendance, getMonthlyAttendance, getTodayAttendance, markAttendance } from "../controllers/attendence.controllers.js";
import { generateresetPasswordToken , validateOTPandChangePassword } from "../service/reset.service.js"
import { Admin } from "../models/admin.models.js";
import { changePassword } from "../service/change.password.service.js";
import { addBenefits, addPlan, destroyPlan, editPlan, fetchAllPlans, fetchParticularPlan, fetchPtPlans, fetchSubPlans, removeBenefits } from "../controllers/plans.controllers.js";
import { approve, fetchAllRequests, fetchParticularRequest } from "../controllers/user.ptbill.temp.controllers.js";
import { addOffer, deleteOffer, editOffer, fetchOffer, toggleOfferActive } from "../controllers/offer.controllers.js";
import { assignWorkoutToUser, deleteAssignedWorkout, deleteExerciseFromAssignedWorkout, getAllAssignedWorkouts, getSingleAssignedWorkout, getUserWorkout, updateCurrentWeek, updateExerciseInAssignedWorkout, updateWorkoutStatus } from "../controllers/assignedWorkout.controllers.js";
import { addPaymentIn, deletePaymentIn, editPaymentIn } from "../controllers/paymentIn.controllers.js";
import { addFood, getAllFoods } from "../controllers/food.controllers.js";
import { getAdminTodayOfTrainerAttendance, getSingleTrainerMonthlyAttendance, getTrainerMonthlyAttendance } from "../controllers/trainerAttendance.controllers.js";
const router = Router();

router.route("/register").post(registerAdmin);
router.route("/login").post(loginAdmin);
router.route("/logout").post(verifyJWT, logOutAdmin);
router.route("/change/password").patch(verifyJWT,isAdmin,changePassword(Admin))
router.route("/reset/password/token").post(generateresetPasswordToken(Admin))
router.route("/reset/password").post(validateOTPandChangePassword(Admin))

// user/member
router
  .route("/registerUser")
  .post(upload.single("avatar"), verifyJWT, isAdmin, registerUser);
router.route("/destroy-user/:id").delete(verifyJWT, isAdmin, destroyUser);
router
  .route("/renewalSubscription/:id/:planId")
  .patch(verifyJWT, isAdmin, renewalSubscription);
router
  .route("/edit-user/:id")
  .patch(upload.single("avatar"), verifyJWT, isAdmin, editUser);
router.route("/fetchAllUser").get(verifyJWT, isAdmin, fetchAllUser);
router
  .route("/fetchParticularUser/:id")
  .get(verifyJWT, isAdmin, fetchParticularUser);
// personal traninng
router
  .route("/personal-training/:member_id/:trainer_id/:plan_id")
  .post(verifyJWT, isAdmin, assignPT);
router
  .route("/personal-training-renewal/:member_id/:trainer_id/:plan_id")
  .post(verifyJWT, isAdmin, renewalPtSub);

// supplement
router
  .route("/add-supplement")
  .post(upload.array("images", 6), verifyJWT, isAdmin, addSupplement);

router.route("/edit-supplement/:id").patch(upload.single("images"),verifyJWT, isAdmin, editSupplement);

router
  .route("/destroy-supplement/:id")
  .delete(verifyJWT, isAdmin, destroySupplement);

router.route("/fetch-supplements").get(verifyJWT, isAdmin, fetchAllSupp);
router
  .route("/fetchParticularSupp/:id")
  .get(verifyJWT, isAdmin, fetchParticularSupp);

// trainer
router
  .route("/register-trainer")
  .post(upload.single("avatar"), verifyJWT, isAdmin, registerTrainer);
router.route("/destroy-trainer/:id").delete(verifyJWT, isAdmin, destroyTrainer);
router.route("/edit-trainer/:id").patch(verifyJWT, isAdmin, editTrainer);
router.route("/fetchAllTrainer").get(verifyJWT, isAdmin, fetchAllTrainer);
router
  .route("/fetchParticularTrainer/:id")
  .get(verifyJWT, isAdmin, fetchParticularTrainer);

// pt plans things
router.route("/plan/add").post(verifyJWT,isAdmin,addPlan)
router.route("/plan/edit/:planId").patch(verifyJWT,isAdmin,editPlan)
router.route("/plan/destroy/:planId").delete(verifyJWT,isAdmin,destroyPlan)
router.route("/plan/fetch/all").get(verifyJWT,isAdmin,fetchAllPlans)
router.route("/plan/pt/fetch/all").get(verifyJWT,isAdmin,fetchPtPlans)
router.route("/plan/add/benefit/:planId").patch(verifyJWT,isAdmin,addBenefits)
router.route("/plan/remove/benefit/:planId/:subBenefitId").patch(verifyJWT,isAdmin,removeBenefits)
router.route("/plan/fetch/:planId").get(verifyJWT,isAdmin,fetchParticularPlan)
router.route("/plans/sub/fetch/all").get(verifyJWT,isAdmin,fetchSubPlans)
router.route("/plans/sub/fetch/:planId").get(verifyJWT,isAdmin,fetchParticularPlan)



// approval
router.route("/pt/request/approval/:tempBillId").post(verifyJWT,isAdmin,approve)
router.route("/pt/request/all").get(verifyJWT,isAdmin,fetchAllRequests)
router.route("/pt/request/:reqId").get(verifyJWT,isAdmin,fetchParticularRequest)



// transections
router
  .route("/fetchAllTransactions")
  .get(verifyJWT, isAdmin, fetchAllTransactions);
router
  .route("/calculateTotalInLet")
  .get(verifyJWT, isAdmin, calculateTotalInLet);
router
  .route("/fetchAllCafeOrders")
  .get(verifyJWT,isAdmin,fetchEveryCafeOderOfAllStuff)

// revenew
router.get("/dashboard-revenue", verifyJWT, isAdmin, fetchDashboardRevenue);

// via source
router.get("/revenue-by-source", verifyJWT, isAdmin, fetchRevenueBySource);

// recent trans
router.get("/recent-transactions", verifyJWT, isAdmin, fetchRecentTransactions);

// cafe staffs (admins)
router.route("/add-cafe-admin").post(verifyJWT, isAdmin, addCafeAdmin);
router.route("/fetchAllCafeAdmin").get(verifyJWT, isAdmin, fetchAllCafeAdmin);
router
  .route("/destroyCafeAdmin/:id")
  .delete(verifyJWT, isAdmin, destroyCafeAdmin);
// cafe items
router
  .route("/add-item")
  .post(upload.single("image"), verifyJWT, isAdmin, addCafeItem);
router.route("/destroy-item/:id").delete(verifyJWT, isAdmin, destroyCafeItem);
router.route("/edit-item/:id").post(verifyJWT, isAdmin, editCafeItem);
router.route("/fetchAllCafeItem").get(verifyJWT, isAdmin, fetchAllCafeItems);
router
  .route("/fetchParticularCafeItem/:id")
  .get(verifyJWT, isAdmin, fetchParticularCafeItem);
router
  .route("/toggleAvailability/:id")
  .patch(verifyJWT, isAdmin, toggleAvailabilty);
router.route("/add/cafe/category").post(verifyJWT,addCateGory);
router.route("/get/cafe/categories").get(verifyJWT,isAdmin,getCafeCategories)


// coupon 
router.route("/add-coupon").post(verifyJWT,isAdmin,addCoupon)
router.route("/fetchAllCoupons").get(verifyJWT,isAdmin,fetchAllCoupons)
router.route("/edit-coupon/:id").patch(verifyJWT,isAdmin,editCoupons)
router.route("/toggleCouponExpire/:id").patch(verifyJWT,isAdmin,toggleCouponExpire)
router.route("/destroyCoupon/:id").delete(verifyJWT,isAdmin,destroyCoupon)
router.route("/coupon").post(verifyJWT,isAdmin,fetchParticularCoupon)

// expense
router.route("/add-expense").post(verifyJWT,isAdmin,addExpense)
router.route("/fetchAllExpenses").get(verifyJWT,isAdmin,fetchAllExpenses)
router.route("/fetchEquipmentsExpenses").get(verifyJWT,isAdmin,fetchEquipmentsExpenses)

// payment In 
router.route("/add/payment/in").post(verifyJWT,isAdmin,addPaymentIn)
router.route("/edit/payment/in/:id").patch(verifyJWT,isAdmin,editPaymentIn)
router.route("/delete/payment/in/:id").delete(verifyJWT,isAdmin,deletePaymentIn)



// cron expire routes 

// make this fucntion more secure
// router.route("/test-expiry").get(
//   async (req, res) => {
//   const result = await testSubscriptionExpiry();
//   res.json(result);
// });

// attendence
router.route("/mark/attendence").post(verifyJWT,isAdmin,markAttendance)
router.route("/today/attendence").get(verifyJWT,isAdmin,getTodayAttendance)

router.route("/month/attendence/:memberId").get(verifyJWT,isAdmin,getMemberMonthlyAttendance)

// /api/v1/admin/month/attendence?month=2026-04
router.route("/month/attendence").get(verifyJWT,isAdmin,getMonthlyAttendance)

// trianer attendacnes
router.route("/attendance/trainer/today").get(verifyJWT,isAdmin,getAdminTodayOfTrainerAttendance)
router.route("/attendance/trainer/month").get(verifyJWT,isAdmin,getTrainerMonthlyAttendance)
router.route("/attendance/trainer/:trainerId/month").get(verifyJWT,isAdmin,getSingleTrainerMonthlyAttendance)

// offer
router.route("/offer/add").post(verifyJWT,isAdmin,addOffer)
router.route("/offer/edit/:offerId").post(verifyJWT,isAdmin,editOffer)
router.route("/offer/delete/:offerId").delete(verifyJWT,isAdmin,deleteOffer)
router.route("/offer/toggle/:offerId").patch(verifyJWT,isAdmin,toggleOfferActive)
router.route("/offer/fetch/all").get(verifyJWT,isAdmin,fetchOffer)


// workout

router.route("/create/template").post(verifyJWT,isAdmin,createWorkoutTemplate)
router.route("/get/template/all").get(verifyJWT,isAdmin,getAdminTemplates)

router.route("/get/template/:templateId").get(verifyJWT,isAdmin,getTemplate)
router.route("/delete/template/:templateId").get(verifyJWT,isAdmin,deleteTemplate)
router.route("/template/:templateId/days").post(verifyJWT,isAdmin,addDayToTemplate)
router.route("/template/:templateId/days/:dayId").delete(verifyJWT,isAdmin,deleteDay)

router.route("/template/:templateId/days/:dayId/exercises").post(verifyJWT,isAdmin,addExerciseToDay)
router.route("/template/:templateId/days/:dayId/exercises/:exerciseId").put(verifyJWT,isAdmin,updateExercise)
router.route("/template/:templateId/days/:dayId/exercises/:exerciseId").delete(verifyJWT,isAdmin,deleteExercise)


// assing

// Backend
router.post('/assign/workout', verifyJWT, isAdmin, assignWorkoutToUser)
router.get('/user/:userId/workout', verifyJWT, isAdmin, getUserWorkout)
router.put('/workout/:workoutId/week/:weekNumber/day/:dayId/exercise/:exerciseId', verifyJWT, isAdmin, updateExerciseInAssignedWorkout)
router.put('/workout/:workoutId/current-week', verifyJWT, isAdmin, updateCurrentWeek)
router.put('/workout/:workoutId/status', verifyJWT, isAdmin, updateWorkoutStatus)
router.delete('/workout/:workoutId', verifyJWT, isAdmin, deleteAssignedWorkout)
router.get('/workouts/all', verifyJWT, isAdmin, getAllAssignedWorkouts)


router.get('/workout/:workoutId', verifyJWT, isAdmin, getSingleAssignedWorkout)
router.delete('/workout/:workoutId/week/:weekNumber/day/:dayId/exercise/:exerciseId', verifyJWT, isAdmin, deleteExerciseFromAssignedWorkout)


// 
router.route("/fetch/supp/bill/all").get(verifyJWT,isAdmin,fetchAllSuppBill)
router.route("/supp/bill/toggle/:billId").get(verifyJWT,isAdmin,toggleShipped)


// diet

router.post("/diet/generate", verifyJWT, 
    isAdmin,
     generateDiet);
router.route("/diet/setMacros/:id").patch(verifyJWT,isAdmin,setDietMacros)

router.patch("/diet/approve/:dietId", verifyJWT,
    isAdmin,
    approveDiet);


router.route("/getAllFoods").get(verifyJWT,isAdmin,getAllFoods)


// diet kinda thigns 

router.route("/addFoodtoDB").post(verifyJWT,isAdmin,addFood)
router.route("/addFood/:mealId").post(verifyJWT,isAdmin,foodItemInserction)
router.route("/diet/show/:id").get(verifyJWT,isAdmin,showParticularDiet)
router.route("/diet/check/:id").get(verifyJWT,isAdmin,checkIfDietExists)
router.route("/diet/check/status/:id").get(verifyJWT,isAdmin,approveCheck)
router.route("/diet/:userId/food/remove/:foodId/:mealId").patch(verifyJWT,isAdmin,removeItemFromDiet)
router.route("/diet/add/meal/:id").patch(verifyJWT,isAdmin,createMeal)
router.route("/diet/remove/meal/:mealId/:dietId").patch(verifyJWT,isAdmin,removeMeal)
router.route("/diet/edit/calories/:dietId").patch(verifyJWT,isAdmin,editCalories)





export default router;
