import { Router } from "express";
import { fetchAllSupp, fetchParticularSupp } from "../controllers/supplement.controllers.js";
import { fetchAllTrainer, fetchParticularTrainer } from "../controllers/trainer.controllers.js";

const router = Router();


// supplement
router.route("/fetch-supplements").get(fetchAllSupp)
router.route("/fetchParticularSupp/:id").get(fetchParticularSupp)


// trainer
router.route("/fetchAllTrainer").get(fetchAllTrainer)
router.route("/fetchParticularTrainer/:id").get(fetchParticularTrainer)

export default router;