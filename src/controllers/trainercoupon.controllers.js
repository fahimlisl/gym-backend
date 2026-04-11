import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { TrainerCoupon } from "../models/trainercoupon.models.js";


const addTrainerCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    typeOfCoupon,
    minCartAmount,
    maxDiscount,
    expiryDate,
    isActive,
    value,
  } = req.body;
  const trainerId = req.params.trainerId;
  if (
    [code, typeOfCoupon, expiryDate, value,
      // category
    ].some((t) => !t && t !== 0)
  ) {
    throw new ApiError(
      400,
      "code , type of code , expiry date and status of coupon must require in order to add coupon"
    );
  }
  const coup = await TrainerCoupon.findOne({ code });
  if (coup)
    throw new ApiError(
      400,
      "this code already exists , try to edit or delete before trying again"
    );

  const newcoup = await TrainerCoupon.create({
    trainerId,
    code,
    typeOfCoupon,
    minCartAmount: minCartAmount || null,
    maxDiscount: maxDiscount || null,
    expiryDate,
    isActive,
    value,
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

const editTrainerCoupons = asyncHandler(async (req, res) => {
  const couponId = req.params.id;
  const {
    code,
    typeOfCoupon,
    minCartAmount,
    maxDiscount,
    expiryDate,
    isActive,
    value,
  } = req.body;
  const coupon = await TrainerCoupon.findById(couponId);
  if (!coupon) throw new ApiError(400, "wasn't able to found the coupon");
  const cou = await TrainerCoupon.findByIdAndUpdate(
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

const fetchAllTrainerCoupons = asyncHandler(async (req, res) => {
  const coupons = await TrainerCoupon.find();
  return res
    .status(200)
    .json(
      new ApiResponse(200, coupons, "all coupons successfully been fetched")
    );
});

const toggleTrainerCouponExpire = asyncHandler(async (req, res) => {
  const couponId = req.params.id;
  const { expiryDate } = req.body;
  if (!expiryDate) throw new ApiError(400, "expiray date must required");
  const coupon = await TrainerCoupon.findById(couponId);
  const updatedCoupon = await TrainerCoupon.findByIdAndUpdate(
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

const destroyTrainerCoupon = asyncHandler(async (req, res) => {
  const couponId = req.params.id;
  const coupon = await TrainerCoupon.findByIdAndDelete(couponId);
  if (!coupon)
    throw new ApiError(400, "wasn't able to find and delete coupon!");
  return res
    .status(200)
    .json(new ApiResponse(200,coupon,"coupon has been successfully destroyed!"))
});


const fetchParticularTrainerCoupon = asyncHandler(async(req,res) => {
  const {code} = req.body;
  const c = await TrainerCoupon.findOne({code})
  if(!c) throw new ApiError(400,"wasn't able to found coupon!")
  
  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      c,
      "coupon successfully fetched"
    )
  )
})

const fetchCouponForTrainerSelf = asyncHandler(async(req,res) => {
  const trainerId = req.user._id;
  const coupon = await TrainerCoupon.findOne({trainerId});
  if(!coupon){
    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "coupon has not been assigned to trainer"
      )
    )
  }
  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      coupon,
      "coupon has been fetcehd successfully for particular trianer"
    )
  )
})



export {
    addTrainerCoupon,
    editTrainerCoupons,
    fetchAllTrainerCoupons,
    destroyTrainerCoupon,
    toggleTrainerCouponExpire,
    fetchParticularTrainerCoupon,
    fetchCouponForTrainerSelf
}