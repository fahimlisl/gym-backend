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
  fetchParticularSupp,
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
  changePassword,
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
  destroyCafeItem,
  editCafeItem,
  fetchAllCafeItems,
  fetchEveryCafeOderOfAllStuff,
  fetchParticularCafeItem,
  toggleAvailabilty,
} from "../controllers/cafeItem.controllers.js";
import { addCoupon, destroyCoupon, editCoupons, fetchAllCoupons, toggleCouponExpire } from "../controllers/coupon.controllers.js";
import { addExpense, fetchAllExpenses, fetchEquipmentsExpenses } from "../controllers/expense.controllers.js";
import { testSubscriptionExpiry } from "../cron/subscriptionExpire.cron.js";
import { getMemberMonthlyAttendance, getMonthlyAttendance, getTodayAttendance, markAttendance } from "../controllers/attendence.controllers.js";
import { generateresetPasswordToken , validateOTPandChangePassword } from "../service/reset.service.js"
import { Admin } from "../models/admin.models.js";
const router = Router();

router.route("/register").post(registerAdmin);
router.route("/login").post(loginAdmin);
router.route("/logout").post(verifyJWT, logOutAdmin);
router.route("/change/password").patch(verifyJWT,isAdmin,changePassword)
router.route("/reset/password/token").post(generateresetPasswordToken(Admin))
router.route("/reset/password").post(validateOTPandChangePassword(Admin))

// user/member
router
  .route("/registerUser")
  .post(upload.single("avatar"), verifyJWT, isAdmin, registerUser);
router.route("/destroy-user/:id").delete(verifyJWT, isAdmin, destroyUser);
router
  .route("/renewalSubscription/:id")
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
  .route("/personal-training/:member_id/:trainer_id")
  .post(verifyJWT, isAdmin, assignPT);
router
  .route("/personal-training-renewal/:member_id/:trainer_id")
  .post(verifyJWT, isAdmin, renewalPtSub);

// supplement
router
  .route("/add-supplement")
  .post(upload.array("images", 6), verifyJWT, isAdmin, addSupplement);

router.route("/edit-supplement/:id").patch(verifyJWT, isAdmin, editSupplement);

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


// coupon 
router.route("/add-coupon").post(verifyJWT,isAdmin,addCoupon)
router.route("/fetchAllCoupons").get(verifyJWT,isAdmin,fetchAllCoupons)
router.route("/edit-coupon/:id").patch(verifyJWT,isAdmin,editCoupons)
router.route("/toggleCouponExpire/:id").patch(verifyJWT,isAdmin,toggleCouponExpire)
router.route("/destroyCoupon/:id").delete(verifyJWT,isAdmin,destroyCoupon)

// expense
router.route("/add-expense").post(verifyJWT,isAdmin,addExpense)
router.route("/fetchAllExpenses").get(verifyJWT,isAdmin,fetchAllExpenses)
router.route("/fetchEquipmentsExpenses").get(verifyJWT,isAdmin,fetchEquipmentsExpenses)




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


export default router;
