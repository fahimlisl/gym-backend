import { Router } from "express";
import { upload } from "../middlewares/multer.middlewares.js";
import { addSupplement } from "../controllers/supplement.controllers.js";

const router = Router();

router.route("/add-supplement").post(upload.array("images", 4), addSupplement);

export default router;
