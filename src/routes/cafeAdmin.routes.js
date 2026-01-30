import { Router } from "express";
import { loginCafeAdmin, logoutCafeAdmin } from "../controllers/cafeAdmin.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { addCafeItem, destroyCafeItem, editCafeItem, fetchAllCafeItems, fetchParticularCafeItem, toggleAvailabilty } from "../controllers/cafeItem.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";

const router = Router();

// /api/v1/cafe/admin

router.route("/login").post(loginCafeAdmin)
router.route("/logout").post(verifyJWT,logoutCafeAdmin)

// items 
router.route("/add-item").post(upload.single("image"),verifyJWT,addCafeItem)
router.route("/destroy-item/:id").delete(verifyJWT,destroyCafeItem)
router.route("/edit-item/:id").post(verifyJWT,editCafeItem)
router.route("/fetchAllCafeItem").get(verifyJWT,fetchAllCafeItems)
router.route("/fetchParticularCafeItem/:id").get(verifyJWT,fetchParticularCafeItem)
router.route("/toggleAvailability/:id").patch(verifyJWT,toggleAvailabilty)

export default router;