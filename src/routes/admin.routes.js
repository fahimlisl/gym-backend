import { Router } from "express";
import { loginAdmin, logOutAdmin, registerAdmin } from "../controllers/admin.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { addSupplement, destroySupplement, editSupplement, fetchAllSupp, fetchParticularSupp } from "../controllers/supplement.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { isAdmin } from "../middlewares/isAdmin.middlewares.js";
import { destroyTrainer, editTrainer, fetchAllTrainer, fetchParticularTrainer, registerTrainer } from "../controllers/trainer.controllers.js";
import { destroyUser, editUser, registerUser, renewalSubscription } from "../controllers/user.controllers.js";
const router = Router();

router.route("/register").post(registerAdmin)
router.route("/login").post(loginAdmin)
router.route("/logout").post(verifyJWT,logOutAdmin)

// user/member
router.route("/registerUser").post(upload.single("avatar"),verifyJWT,isAdmin,registerUser)
router.route("/destroy-user/:id").delete(verifyJWT,isAdmin,destroyUser)
router.route("/renewalSubscription/:id").patch(verifyJWT,isAdmin,renewalSubscription)

router.route("/edit-user/:id").patch(upload.single("avatar"),verifyJWT,isAdmin,editUser) 


// supplement
router.route("/add-supplement").post(upload.array("images", 6),verifyJWT,isAdmin,addSupplement);

router.route("/edit-supplement/:id").patch(verifyJWT,isAdmin,editSupplement) 

router.route("/destroy-supplement/:id").delete(verifyJWT,isAdmin,destroySupplement)

router.route("/fetch-supplements").get(verifyJWT,isAdmin,fetchAllSupp)
router.route("/fetchParticularSupp/:id").get(verifyJWT,isAdmin,fetchParticularSupp)


// trainer
router.route("/register-trainer").post(upload.single("avatar"),verifyJWT,isAdmin,registerTrainer)
router.route("/destroy-trainer/:id").delete(verifyJWT,isAdmin,destroyTrainer)
router.route("/edit-trainer/:id").patch(verifyJWT,isAdmin,editTrainer)
router.route("/fetchAllTrainer").get(verifyJWT,isAdmin,fetchAllTrainer)
router.route("/fetchParticularTrainer/:id").get(verifyJWT,isAdmin,fetchParticularTrainer)
export default router