import { Router } from "express";
import { fetchAllSupp, fetchParticularSupp } from "../controllers/supplement.controllers.js";
import { fetchAllTrainer, fetchParticularTrainer } from "../controllers/trainer.controllers.js";
import { fetchAllPlans } from "../controllers/plans.controllers.js";

const router = Router();


// supplement
router.route("/fetch-supplements").get(fetchAllSupp)
router.route("/fetchParticularSupp/:id").get(fetchParticularSupp)


// trainer
router.route("/fetchAllTrainer").get(fetchAllTrainer)
router.route("/fetchParticularTrainer/:id").get(fetchParticularTrainer)

//pricing
router.route("/plan/fetch/all").get(fetchAllPlans)

export default router;