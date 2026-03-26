import { Router } from "express";
import { checkoutSupplements, checkUserSupp, fetchAllSupp, fetchParticularSupp, validateSupplementCoupon } from "../controllers/supplement.controllers.js";
import { fetchAllTrainer, fetchParticularTrainer } from "../controllers/trainer.controllers.js";
import { fetchAllPlans } from "../controllers/plans.controllers.js";
import { fetchParticularCoupon } from "../controllers/coupon.controllers.js";
import { fetchOffer } from "../controllers/offer.controllers.js";
import { markAttendanceByQR } from "../controllers/attendence.controllers.js";

const router = Router();


// supplement
router.route("/fetch-supplements").get(fetchAllSupp)
router.route("/fetchParticularSupp/:id").get(fetchParticularSupp)


// trainer
router.route("/fetchAllTrainer").get(fetchAllTrainer)
router.route("/fetchParticularTrainer/:id").get(fetchParticularTrainer)

//pricing
router.route("/plan/fetch/all").get(fetchAllPlans)

//
router.route("/coupon").post(fetchParticularCoupon)
router.route("/offer/fetch/all").get(fetchOffer)
// attendance public — no auth middleware
router.post("/attendance/qr", markAttendanceByQR);

router.post("/supplements/validate-coupon", validateSupplementCoupon);
router.post("/supplements/checkout", checkoutSupplements);
router.get("/user/check-phone/:phoneNumber",checkUserSupp)

export default router;