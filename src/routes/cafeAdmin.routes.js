import { Router } from "express";
import { loginCafeAdmin, logoutCafeAdmin } from "../controllers/cafeAdmin.controllers.js";
import { verifyJWT } from "../middlewares/auth.middlewares.js";
import { addCafeItem, addToCart, checkout, decrementCartItem, destroyCafeItem, editCafeItem, fetchAllCafeItems, fetchCart, fetchParticularCafeItem, removeFromCart, toggleAvailabilty } from "../controllers/cafeItem.controllers.js";
import { upload } from "../middlewares/multer.middlewares.js";
import { applyCoupon, removeCoupon } from "../controllers/coupon.controllers.js";

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

//cart
router.route("/addToCart").post(verifyJWT,addToCart)
router.route("/checkout").post(verifyJWT,checkout)
router.route("/fetchCart").get(verifyJWT,fetchCart)
router.route("/removeFromCart").patch(verifyJWT,removeFromCart)
router.route("/decrementCartItem").patch(verifyJWT,decrementCartItem);

// cart - coupon
router.route("/applyCoupon").patch(verifyJWT,applyCoupon)
router.route("/removeCoupon").patch(verifyJWT,removeCoupon)
export default router;