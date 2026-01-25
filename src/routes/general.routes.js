import { Router } from "express";
import { fetchAllSupp, fetchParticularSupp } from "../controllers/supplement.controllers.js";

const router = Router();


// supplement
router.route("/fetch-supplements").get(fetchAllSupp)
router.route("/fetchParticularSupp/:id").get(fetchParticularSupp)

export default router;