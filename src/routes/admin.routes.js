import { Router } from "express";
import { loginAdmin, logOutAdmin, registerAdmin } from "../controllers/admin.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { addSupplement, destroySupplement, editSupplement, fetchAllSupp, fetchParticularSupp } from "../controllers/supplement.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { isAdmin } from "../middlewares/isAdmin.middlewares.js";
const router = Router();

router.route("/register").post(registerAdmin)
router.route("/login").post(loginAdmin)
router.route("/logout").post(verifyJWT,logOutAdmin)


// supplement
router.route("/add-supplement").post(upload.array("images", 6),verifyJWT,isAdmin,addSupplement);

router.route("/edit-supplement/:id").patch(verifyJWT,isAdmin,editSupplement) 

router.route("/destroy-supplement/:id").delete(verifyJWT,isAdmin,destroySupplement)

router.route("/fetch-supplements").get(verifyJWT,isAdmin,fetchAllSupp)
router.route("/fetchParticularSupp/:id").get(verifyJWT,isAdmin,fetchParticularSupp)

export default router