import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Plan } from "../models/plans.models.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { TempPtBill } from "../models/ptbill.temp.models.js";
import { Coupon } from "../models/coupon.models.js";
import { Admin } from "../models/admin.models.js";
import { Ptbill } from "../models/ptbill.models.js";
import { Transaction } from "../models/transaction.models.js";
import { Trainer } from "../models/trainer.models.js";
import { User } from "../models/user.models.js";

const generateTempPtbill = asyncHandler(async (req, res) => {
  const planId = req.params.planId;
  const userId = req.user._id;
  const plan = await Plan.findById(planId);
  const { coupon, paymentMethod = "upi", ref } = req.body;
  const ptbillCheck = await Ptbill.findOne({user:userId});
  if(ptbillCheck){
    if(ptbillCheck.subscription[ptbillCheck.subscription.length - 1].status === "active"){
      throw new ApiError(400,"you have already one pt plan active, kindly request after expiry!");
    }
  }
  // ref is required in certain conditions cehck ptbill.temp.models.js
  const checkingExistingRequest = await TempPtBill.findOne({ user: userId });
  if (checkingExistingRequest)
    throw new ApiError(
      400,
      "you had already one request on going , kindly wait till it gets accepted!"
    );
  if (!plan) throw new ApiError(400, "got error while selecting plans!");
  if (plan.category !== "PT")
    throw new ApiError(400, "kindly choose a personal training plan!");
  const c = await Coupon.findOne({ code: coupon });
  if (coupon) {
    if (!c) {
      throw new ApiError(
        400,
        "coupon isn't able to find, contact administration!"
      );
    }
    if (!c.isActive)
      throw new ApiError(400, "coupon is not active! contact administrator");
    if (c.category !== "PERSONAL TRAINING")
      throw new ApiError(400, "coupon is not applicable on this category");
    if (c.minCartAmount > plan.finalPrice)
      throw new ApiError(
        400,
        "coupon is not applicable, minimum Cart amount must exceed!"
      );
  }

  const proofBuffer = req.file?.buffer;
  if (!proofBuffer) throw new ApiError(400, "image proof wasn't able to found");

  const imgupload = await uploadOnCloudinary(proofBuffer);

  if (!imgupload)
    throw new ApiError(
      400,
      "wasn't able to upload proof to cloudinary kindly try again later , or conatcat administration"
    );

  let final;
  let discount;
  if (coupon) {
    if (c.typeOfCoupon === "flat") {
      discount = c.value;
      final = plan.finalPrice - discount;
    } else if (c.typeOfCoupon === "percentage") {
      if (c.maxDiscount < (plan.finalPrice * c.value) / 100) {
        discount = c.maxDiscount;
        final = plan.finalPrice - discount;
      } else {
        discount = (plan.finalPrice * c.value) / 100;
        final = plan.finalPrice - discount;
      }
    }
  } else {
    final = plan.finalPrice;
  }

  const tempBill = await TempPtBill.create({
    user: userId,
    plan: plan.duration,
    basePrice: plan.finalPrice,
    finalPrice: final, // need to calcaution before proccedigin
    image: {
      url: imgupload.url,
      public_id: imgupload.public_id,
    },
    discount: {
      amount: discount || 0,
      code: c?.code || "",
      typeOfDiscount: c?.typeOfCoupon || "none",
      value: c?.value || 0,
    },
    isApproved: false,
    paymentMethod,
    ref,
  });

  if (!tempBill) throw new ApiError(500, "internal server error!");

  return res
    .status(200)
    .json(
      new ApiResponse(200, tempBill, "request has been submitted successfully!")
    );
});

// for user
const checkStatus = asyncHandler(async (req, res) => {
  const userId = req?.user?._id;
  const temp = await TempPtBill.findOne({ user: userId });
  // if (!temp) throw new ApiError(400, "there are no ongoing request!");
  if (!temp) {
  return res.status(200).json(
    new ApiResponse(200, null, "no ongoing request")
  );
}
  // will be using fontend to show beautyflly wheaterh approved or not! and all details
  return res
    .status(200)
    .json(new ApiResponse(200, temp, "successfylly fetched request status"));
});

// admin route (secured)
const approve = asyncHandler(async (req, res) => {
  const adminId = req.user._id;
  const tempBillId = req.params.tempBillId;
  const admin = await Admin.findById(adminId); // for extra security layer
  if (!admin) throw new ApiError(400, "approval must be done by admin!");
  const t = await TempPtBill.findById(tempBillId);
  if (!t) throw new ApiError(400, "bill doesn't exist!");
  t.isApproved = true;
  await t.save();
  // await TempPtBill.find
  // thinking about deletation of temp pt bill after approval

  const addMonthsSafe = (date, months) => {
    const d = new Date(date);
    const day = d.getDate();

    d.setMonth(d.getMonth() + months);
    if (d.getDate() !== day) {
      d.setDate(0);
    }

    return d;
  };

  const start = new Date();
  // const start = startDate ? parseDDMMYYYY(startDate) : new Date();

  let monthsToAdd = 0;
  if (t.plan === "monthly") monthsToAdd = 1;
  else if (t.plan === "quarterly") monthsToAdd = 3;
  else if (t.plan === "half-yearly") monthsToAdd = 6;
  else if (t.plan === "yearly") monthsToAdd = 12;
  else throw new ApiError(400, "Invalid plan");

  const endDate = addMonthsSafe(start, monthsToAdd);

  const bill = await Ptbill.create({
    user: t.user,
    subscription: [
      {
        plan: t.plan,
        basePrice: t.basePrice,
        finalPrice: t.finalPrice,
        discount: {
          amount: t.discount.amount,
          typeOfDiscount: t.discount.typeOfDiscount,
          value: t.discount.value,
          code: t.discount.value,
        },
        paymentMethod: t.paymentMethod,
        ref: t.ref,
        status: "active",
        startDate:start,
        endDate,
      },
    ],
  });

  // need to add a n8n automation , saying approval is done , now select your trainer

  const trans = await Transaction.create({
    user:t.user,
    source:"personal-training",
    referenceModel:"Ptbill",
    amount:t.finalPrice,
    paymentMethod:t.paymentMethod,
    status:"success",
    paidAt:t.createdAt,
    referenceId:bill._id
  })

  if(!trans) throw new ApiError(500,"internal server error!");
  await User.findByIdAndUpdate(t.user,
    {
      $set:{
        personalTraning:bill._id
      }
    },
    {
      new:true
    }
  )


  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      bill,
      "successfully approved!"
    )
  )
});

// admin route
const fetchAllRequests = asyncHandler(async(req,res) => {
  const requets = await TempPtBill.find({});

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      requets,
      "all requests are fetched successfully !"
    )
  )

});

// admin route
const fetchParticularRequest = asyncHandler(async(req,res) => {
  const reqId = req.params.reqId;
  const request = await TempPtBill.findById(reqId);
  if(!request) throw new ApiError(400,"wasn't able to fetch particular request regarding this request id");

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      request,
      "particular request has been successfully fetched!"
    )
  )
});

// user route
const getTrainer = asyncHandler(async(req,res) => {
  const userId = req.user._id;

  const trainerId = req.params.trainerId;
  const temp = await TempPtBill.findOne({user:userId});


  if(!temp.isApproved){
    throw new ApiError(400,"request has not been approved by admin!");
  }
  const trainer = await Trainer.findByIdAndUpdate(
    trainerId,
    {
      $addToSet: {
        students: {
          student: userId
        }
      }
    },
    { new: true }
  );
  if(!trainer) throw new ApiError(400,"trainer not found! try again later!");
  const p = await Ptbill.findOne({user:userId})
  p.subscription[p.subscription.length -1 ].trainer = trainerId;

  await p.save({validateBeforeSave:false});
  
  // deleteing image from cloudinary and temporary document from tempPtBill collection
  const t = await TempPtBill.findOneAndDelete({user:userId});
  await deleteFromCloudinary(t.image.public_id);

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      {},
      "trainer have been successfully assigned to you!"
    )
  );
});

export { 
  generateTempPtbill, 
  checkStatus, 
  fetchAllRequests, 
  approve, 
  fetchParticularRequest, 
  getTrainer
};
