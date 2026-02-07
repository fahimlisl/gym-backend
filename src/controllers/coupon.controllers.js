import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Coupon } from "../models/coupon.models.js";
import { CafeCart } from "../models/cafeCart.models.js";

const addCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    typeOfCoupon,
    minCartAmount,
    maxDiscount,
    expiryDate,
    isActive,
    value,
    category
  } = req.body;
  if (
    [code, typeOfCoupon, expiryDate, value,category].some((t) => !t && t !== 0)
  ) {
    throw new ApiError(
      400,
      "code , type of code , expiry date and status of coupon must require in order to add coupon"
    );
  }
  const coup = await Coupon.findOne({ code });
  if (coup)
    throw new ApiError(
      400,
      "this code already exists , try to edit or delete before trying again"
    );

  const newcoup = await Coupon.create({
    code,
    typeOfCoupon,
    minCartAmount: minCartAmount || null,
    maxDiscount: maxDiscount || null,
    expiryDate,
    isActive,
    value,
    category
  });

  if (!newcoup)
    throw new ApiError(
      500,
      "internal server error , wasn't able to add coupon"
    );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        newcoup,
        "coupon has been successfully added to database"
      )
    );
});

const editCoupons = asyncHandler(async (req, res) => {
  const couponId = req.params.id;
  const {
    code,
    typeOfCoupon,
    minCartAmount,
    maxDiscount,
    expiryDate,
    isActive,
    value,
    category
  } = req.body;
  const coupon = await Coupon.findById(couponId);
  if (!coupon) throw new ApiError(400, "wasn't able to found the coupon");
  const cou = await Coupon.findByIdAndUpdate(
    coupon._id,
    {
      $set: {
        code: code || coupon.code,
        typeOfCoupon: typeOfCoupon || coupon.typeOfCoupon,
        minCartAmount: minCartAmount || coupon.minCartAmount,
        maxDiscount: maxDiscount || coupon.maxDiscount,
        expiryDate: expiryDate || coupon.expiryDate,
        isActive: isActive || coupon.isActive,
        value: value || coupon.value,
        category: category || coupon.category
      },
    },
    {
      new: true,
    }
  );
  if (!cou) throw new ApiError(500, "wasn't able to update coupon");

  return res
    .status(200)
    .json(new ApiResponse(200, cou, "coupon has been successfully updated"));
});

const fetchAllCoupons = asyncHandler(async (req, res) => {
  const coupons = await Coupon.find();
  return res
    .status(200)
    .json(
      new ApiResponse(200, coupons, "all coupons successfully been fetched")
    );
});

// can be improved more and more , will take a glimpse before putting to production
const toggleCouponExpire = asyncHandler(async (req, res) => {
  const couponId = req.params.id;
  const { expiryDate } = req.body;
  if (!expiryDate) throw new ApiError(400, "expiray date must required");
  const coupon = await Coupon.findById(couponId);
  const updatedCoupon = await Coupon.findByIdAndUpdate(
    couponId,
    {
      $set: {
        isActive: !coupon.isActive,
        expiryDate,
      },
    },
    {
      new: true,
    }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedCoupon,
        "coupon has been updated successfully"
      )
    );
});

const destroyCoupon = asyncHandler(async (req, res) => {
  const couponId = req.params.id;
  const coupon = await Coupon.findByIdAndDelete(couponId);
  if (!coupon)
    throw new ApiError(400, "wasn't able to find and delete coupon!");
  return res
    .status(200)
    .json(200, coupon, "coupon has been successfully destroyed!");
});

const applyCoupon = asyncHandler(async (req, res) => {
  const cafeAdminId = req.user._id;
  const { code } = req.body;

  const coupon = await Coupon.findOne({ code });
  if (!coupon) {
    throw new ApiError(404, "Invalid coupon code");
  }

  if (!coupon.isActive) {
    throw new ApiError(400, "Coupon is inactive");
  }

  if(coupon.category !== "CAFE"){
    throw new ApiError(400,"wasn't able to apply, cateogry of coupon isn't CAFE!")
  }

  // if (coupon.expiryDate && coupon.expiryDate < new Date()) { // for later
  //   throw new ApiError(400, "Coupon has expired");
  // }

  const cart = await CafeCart.findOne({ handledBy: cafeAdminId });
  if (!cart || cart.items.length === 0) {
    throw new ApiError(400, "Cart is empty");
  }

  const subtotal = Number(cart.totalAmount);

  if (
    coupon.minCartAmount &&
    subtotal < Number(coupon.minCartAmount)
  ) {
    throw new ApiError(
      400,
      `Minimum cart amount ₹${coupon.minCartAmount} required`
    );
  }

  let discountAmount = 0;

  if (coupon.typeOfCoupon === "flat") {
    discountAmount = Number(coupon.value);
  }

  if (coupon.typeOfCoupon === "percentage") {
    discountAmount = (subtotal * Number(coupon.value)) / 100;
  }

  if (
    coupon.maxDiscount &&
    discountAmount > Number(coupon.maxDiscount)
  ) {
    discountAmount = Number(coupon.maxDiscount);
  }

  if (discountAmount > subtotal) {
    discountAmount = subtotal;
  }

  const finalAmount = subtotal - discountAmount;

  const updatedCart = await CafeCart.findOneAndUpdate(
    { handledBy: cafeAdminId },
    {
      $set: {
        totalAmount: finalAmount,
        discount: {
          amount: discountAmount,
          typeOfDiscount: coupon.typeOfCoupon,
          value: coupon.value,
          code: coupon.code,
        },
      },
    },
    { new: true }
  );

  if (!updatedCart) {
    throw new ApiError(
      500,
      "Failed to apply coupon to cart"
    );
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      updatedCart,
      "Coupon applied successfully"
    )
  );
});


const removeCoupon = asyncHandler(async (req, res) => {
  const adminId = req.user._id;

  const cart = await CafeCart.findOne({ handledBy: adminId });

  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  if (!cart.discount || !cart.discount.amount) {
    throw new ApiError(400, "No coupon applied to cart");
  }

  // restore original amount
  const restoredTotal =
    Number(cart.totalAmount) + Number(cart.discount.amount);

  cart.totalAmount = restoredTotal;
  cart.discount = undefined; // remove coupon snapshot

  await cart.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      cart,
      "Coupon removed successfully"
    )
  );
});

export {
  addCoupon,
  fetchAllCoupons,
  editCoupons,
  toggleCouponExpire,
  destroyCoupon,
  applyCoupon,
  removeCoupon
};
