import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import generateAccessAndRefreshToken from "../utils/generateANR.js";
import { options } from "../utils/options.js";
import { User } from "../models/user.models.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { Subscription } from "../models/subscription.models.js";
import { Transaction } from "../models/transaction.models.js";
import { Ptbill } from "../models/ptbill.models.js";
import { Trainer } from "../models/trainer.models.js";
import axios from "axios"
import { Coupon } from "../models/coupon.models.js";
import { Plan } from "../models/plans.models.js";


const registerUser = asyncHandler(async (req, res) => {
  const {
    username,
    email,
    phoneNumber,
    planId,
    paymentStatus,
    admissionFee,
    paymentMethod,
    discountTypeOnAdFee,
    discountOnAdFee,
    paymentId,
    orderId,
    coupon, // ✅ NEW
  } = req.body;

  if (!planId) {
    throw new ApiError(400, "planId is required");
  }

  if ([username, phoneNumber].some((v) => !v && v !== 0)) {
    throw new ApiError(400, "username, phoneNumber are required");
  }

  const exists = await User.findOne({
    $or: [{ email: email || null }, { phoneNumber }],
  });

  if (exists) {
    throw new ApiError(400, "user already exists");
  }

  const plan = await Plan.findById(planId);
  if (!plan) throw new ApiError(404, "Plan not found");

  let c = null;
  let subscriptionDiscountAmount = 0;

  if (coupon) {
    c = await Coupon.findOne({ code: coupon });

    if (!c) throw new ApiError(400, "Coupon not found");
    if (!c.isActive) throw new ApiError(400, "Coupon inactive");
    if (c.category !== "SUBSCRIPTION") {
      throw new ApiError(400, "Invalid coupon category");
    }
    if (c.minCartAmount > plan.finalPrice) {
      throw new ApiError(400, "Minimum cart not met");
    }

    if (c.typeOfCoupon === "flat") {
      subscriptionDiscountAmount = c.value;
    } else if (c.typeOfCoupon === "percentage") {
      const percentage = (plan.finalPrice * c.value) / 100;
      subscriptionDiscountAmount = Math.min(
        percentage,
        c.maxDiscount || percentage
      );
    }
  }

  let finalSubscriptionAmount =
    plan.finalPrice - subscriptionDiscountAmount;

  if (finalSubscriptionAmount < 0) finalSubscriptionAmount = 0;

  let admissionDiscountAmount = 0;

  if (discountTypeOnAdFee === "percentage") {
    admissionDiscountAmount =
      (Number(admissionFee || 0) * Number(discountOnAdFee || 0)) / 100;
  } else if (discountTypeOnAdFee === "flat") {
    admissionDiscountAmount = Number(discountOnAdFee || 0);
  }

  const finalAdFee =
    Number(admissionFee || 0) - admissionDiscountAmount;

  const defaultPassword = username.slice(0, 3).toLowerCase() +
    Math.floor(100 + Math.random() * 900);

  let avatarOnCloud = null;
  if (req.file?.buffer) {
    avatarOnCloud = await uploadOnCloudinary(req.file.buffer);
    if (!avatarOnCloud) {
      throw new ApiError(400, "failed to upload avatar");
    }
  }
  else {
    try {
      const initials = username
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
        username
      )}&background=ef4444&color=fff&bold=true`;

      avatarOnCloud = {
        url: avatarUrl,
        public_id: `avatar_${phoneNumber}_${Date.now()}`,
      };
    } catch (error) {
      console.error("Failed to generate default avatar:", error);
      avatarOnCloud = {
        url: "https://ui-avatars.com/api/?name=User&background=ef4444&color=fff",
        public_id: `avatar_default_${Date.now()}`,
      };
    }
  }

  const user = await User.create({
    username,
    email: email || "",
    phoneNumber,
    password: defaultPassword,
    isActive: true,
    avatar:{
      url:avatarOnCloud.url,
      public_id:avatarOnCloud.public_id
    }
  });

  const startDate = new Date();
  let monthsToAdd = 0;

  if (plan.duration === "monthly") monthsToAdd = 1;
  else if (plan.duration === "quarterly") monthsToAdd = 3;
  else if (plan.duration === "half-yearly") monthsToAdd = 6;
  else if (plan.duration === "yearly") monthsToAdd = 12;

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + monthsToAdd);

  const subPayload = {
    plan: plan.duration,
    baseAmount: plan.finalPrice,
    startDate,
    endDate,
    status: "active",
    paymentStatus: paymentStatus || "paid",

    discount: {
      amount: subscriptionDiscountAmount,
      typeOfDiscount: c?.typeOfCoupon || "",
      value: c?.value || 0,
      code: c?.code || "",
    },

    finalAmount: finalSubscriptionAmount,
    paymentMethod: paymentMethod || "razorpay",
  };

  const subscription = await Subscription.create({
    user: user._id,
    admissionFee: Number(admissionFee || 0),
    discountTypeOnAdFee,
    discountOnAdFee: Number(discountOnAdFee || 0),
    finalAdFee,
    subscription: [subPayload],
  });

  await User.findByIdAndUpdate(user._id, {
    $set: { subscription: subscription._id },
  });

  const totalAmount =
    finalSubscriptionAmount + finalAdFee;

  const transaction = await Transaction.create({
    user: user._id,
    source: "subscription",
    referenceId: subscription._id,
    subReferenceId: subscription.subscription[0]._id,
    amount: totalAmount,
    paymentMethod: paymentMethod || "razorpay",
    referenceModel: "Subscription",
    paymentId,
    orderId,
    status: "success",
  });

  try {
  await axios.post(process.env.N8N_WEBHOOK_URL, {
    eventType: "new_member",
    memberName: username,
    email: email || "",
    phoneNumber: phoneNumber,
    plan: plan.duration,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    price: plan.finalPrice,
    discountApplied: subscriptionDiscountAmount,
    finalAmount: totalAmount,
    couponUsed: coupon || null,
    registrationDate: new Date().toISOString(),
    password: defaultPassword,
  });
} catch (error) {
  console.error("Failed to trigger n8n webhook:", error);
  // Don't throw - webhook failure shouldn't break registration
}



  return res.status(200).json(
    new ApiResponse(
      200,
      {
        user,
        subscription,
        transaction,
        finalAmount: totalAmount,
      },
      "User registered successfully with coupon support"
    )
  );
});


const checkUser = asyncHandler(async(req,res) => {
  const {phoneNumber,email} = req.body;
  const user = await User.findOne({
    $or:[
      {email},{phoneNumber}
    ]
  })
  if(!user){ // !user === !null -> true
    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        false, // use doens't exist can procede to next steps 
        "user doesn't exist"
      )
    )
  }
  else{
    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        true, // use already exists cannot procede to next steps 
        "user already exist"
      )
    )
  }
});


const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  path: "/",
};

const loginUser = asyncHandler(async (req, res) => {
  const { email, phoneNumber, password } = req.body;

  if (!(email || phoneNumber)) {
    throw new ApiError(400, "Email or phone number required");
  }

  if (!password) {
    throw new ApiError(400, "Password required");
  }

  const user = await User.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (!user) {
    throw new ApiError(401, "User not found");
  }

  const isMatch = await user.isPasswordCorrect(password);

  if (!isMatch) {
    throw new ApiError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken } =
    await generateAccessAndRefreshToken(user._id, User);

  const safeUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  res.cookie("accessToken", accessToken, cookieOptions);
  res.cookie("refreshToken", refreshToken, cookieOptions);

  return res.status(200).json({
    success: true,
    message: "User logged in successfully",
    user: safeUser,
    accessToken,
    refreshToken,
  });
});

const logOutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    $unset: { refreshToken: 1 },
  });

  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });

  return res.status(200).json({
    success: true,
    message: "User logged out successfully",
  });
});


const destroyUser = asyncHandler(async (req, res) => {
  const userId = req.params.id;
  const user = await User.findByIdAndDelete(userId);
  if (!user) {
    throw new ApiError(400, "wasn't able to destroy member");
  }
  const delAvatar = await deleteFromCloudinary(user.avatar.public_id);
  if (!delAvatar) {
    throw new ApiError(400, "wasn't able to delete avatar form cloud");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, {}, "member and avatar been deleted successsfully")
    );
});

// const parseDDMMYYYY = (value) => {
//   if (!value) return new Date();

//   if (value instanceof Date) return value;

//   const [day, month, year] = value.split("/").map(Number);
//   return new Date(year, month - 1, day);
// };

const parseDDMMYYYY = (value) => {
  if (!value) return null;

  // Already a Date
  if (value instanceof Date && !isNaN(value.getTime())) {
    return value;
  }

  // ISO format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  // DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
    const [day, month, year] = value.split("/").map(Number);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};


const addMonthsSafe = (date, months) => {
  const d = new Date(date);
  const day = d.getDate();

  d.setMonth(d.getMonth() + months);

  // handle month overflow (31st → Feb etc.)
  if (d.getDate() !== day) {
    d.setDate(0);
  }

  return d;
};

const renewalSubscription = asyncHandler(async (req, res) => {
  let userId;
  if(!(await User.findById(req.user._id))){
    userId = req.params.id
  }else{
    userId = req.user._id
  }
  const planId = req.params.planId;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "Member not found");

  const plan = await Plan.findById(planId);
  if (!plan) throw new ApiError(404, "Plan not found");

  const { paymentStatus, startDate, paymentMethod } = req.body;
  const { coupon } = req.body;

  let c = null;
  if (coupon) {
    c = await Coupon.findOne({ code: coupon });
    if (!c) {
      throw new ApiError(400, "Coupon not found, contact administration!");
    }
    if (!c.isActive) {
      throw new ApiError(400, "Coupon is not active! Contact administrator");
    }
    if (c.category !== "SUBSCRIPTION") {
      throw new ApiError(400, "Coupon is not applicable on this category");
    }
    if (c.minCartAmount > plan.finalPrice) {
      throw new ApiError(400, "Coupon is not applicable, minimum cart amount not met!");
    }
  }

  let start;
  if (!startDate) {
    start = new Date();
  } else {
    start = parseDDMMYYYY(startDate);
    if (!start || isNaN(start.getTime())) {
      throw new ApiError(400, "Invalid start date format");
    }
  }
  let monthsToAdd = 0;
  if (plan.duration === "monthly") monthsToAdd = 1;
  else if (plan.duration === "quarterly") monthsToAdd = 3;
  else if (plan.duration === "half-yearly") monthsToAdd = 6;
  else if (plan.duration === "yearly") monthsToAdd = 12;
  else throw new ApiError(400, "Invalid plan duration");

  const endDate = addMonthsSafe(start, monthsToAdd);
  if (!endDate || isNaN(endDate.getTime())) {
    throw new ApiError(400, "Failed to calculate end date");
  }

  let final;
  let subscriptionDiscountAmount = 0;

  if (coupon && c) {
    if (c.typeOfCoupon === "flat") {
      subscriptionDiscountAmount = c.value;
      final = plan.finalPrice - subscriptionDiscountAmount;
    } else if (c.typeOfCoupon === "percentage") {
      const percentageDiscount = (plan.finalPrice * c.value) / 100;
      subscriptionDiscountAmount = Math.min(percentageDiscount, c.maxDiscount || percentageDiscount);
      final = plan.finalPrice - subscriptionDiscountAmount;
    }
  } else {
    final = plan.finalPrice;
  }

  if (final < 0) final = 0;

  let subscription = await Subscription.findOne({ user: userId });
  
  if (!subscription) {
    subscription = await Subscription.create({
      user: userId,
      subscription: [],
      admissionFee: 0,
      discountTypeOnAdFee: "none",
      discountOnAdFee: 0,
      finalAdFee: 0,
    });
  }

  const renewal = await Subscription.findByIdAndUpdate(
    subscription._id,
    {
      $push: {
        subscription: {
          plan: plan.duration,
          baseAmount: plan.finalPrice,
          startDate: start,
          endDate: endDate,
          status: "active",
          discount: {
            amount: subscriptionDiscountAmount || 0,
            typeOfDiscount: c?.typeOfCoupon || "",
            value: c?.value || 0,
            code: c?.code || "",
          },
          finalAmount: final,
          paymentStatus: paymentStatus || "paid",
          paymentMethod: paymentMethod || "razorpay",
        },
      },
    },
    { new: true }
  );

  if (!renewal) {
    throw new ApiError(400, "Failed to renew subscription");
  }

  await User.findByIdAndUpdate(
    userId,
    { $set: { isActive: true } },
    { new: true }
  );

  const latestSub = renewal.subscription[renewal.subscription.length - 1];

  const transaction = await Transaction.create({
    user: user._id,
    source: "subscription",
    referenceId: renewal._id,
    subReferenceId: latestSub._id,
    amount: final,
    paymentMethod: paymentMethod || "razorpay",
    referenceModel: "Subscription",
  });

  if (!transaction) {
    await Subscription.findByIdAndUpdate(renewal._id, {
      $pop: { subscription: 1 },
    });
    throw new ApiError(400, "Failed to generate transaction");
  }

  try {
    await axios.post(process.env.N8N_WEBHOOK_URL, {
      eventType: "subscription_renewal",
      memberName: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      plan: plan.duration,
      planTitle: plan.title,
      startDate: start.toISOString(),
      endDate: endDate.toISOString(),
      finalAmount: final,
      renewalDate: new Date().toISOString(),
      renewalNumber: renewal.subscription.length,
    });
  } catch (error) {
    console.error("Failed to trigger renewal email:", error.message);
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { renewal, transaction, finalAmount: final },
        "Renewal completed successfully"
      )
    );
});


const editUser = asyncHandler(async (req, res) => {
  const { username, email, phoneNumber } = req.body;
  const userId = req.params.id;
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  const updateData = {
    username: username ?? user.username,
    phoneNumber: phoneNumber ?? user.phoneNumber,

    email: email ?? user.email ?? "",
  };

  if (req.file?.buffer) {
    if (user.avatar?.public_id) {
      await deleteFromCloudinary(user.avatar.public_id);
    }

    const avatarf = await uploadOnCloudinary(req.file.buffer);

    updateData.avatar = {
      url: avatarf.url,
      public_id: avatarf.public_id,
    };
  }

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $set: updateData },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "User updated successfully"));
});

// will add a lil changes for fetching when users count is 0
const fetchAllUser = asyncHandler(async (req, res) => {
  const users = await User.find({}).populate("subscription");
  if (!users) {
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "currently no members are admitted yet"));
  } else {
    return res
      .status(200)
      .json(new ApiResponse(200, users, "successfully fetched all members"));
  }
});

const fetchParticularUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id)
    .populate({
      path: "subscription",
    })
    .populate({
      path: "personalTraning",
      populate: {
        path: "subscription.trainer",
        model: "Trainer",
        select: "fullName phoneNumber avatar experience",
      },
    });
  if (!user) throw new ApiError(400, "user wasn't able to found");

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user,
        "member of the particular id been successflly fetched"
      )
    );
});

const assignPT = asyncHandler(async (req, res) => {
  const userId = req.params.member_id;
  const trainerId = req.params.trainer_id;
  const planId = req.params.plan_id;
  const {paymentMethod,ref,startDate} = req.body;
  const plan = await Plan.findById(planId)

  const { coupon } = req.body;
  const c = await Coupon.findOne({code:coupon});
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

  if (!(plan)){
    throw new ApiError(400, "plan Type must required");
  }
  const d = startDate || new Date()
  const start = parseDDMMYYYY(d);
  if (!start) {
  throw new ApiError(
    400,
    "Invalid startDate. Use DD/MM/YYYY or YYYY-MM-DD"
  );
  }

  let monthsToAdd = 0;
  if (plan.duration === "monthly") monthsToAdd = 1;
  else if (plan.duration === "quarterly") monthsToAdd = 3;
  else if (plan.duration === "half-yearly") monthsToAdd = 6;
  else if (plan.duration === "yearly") monthsToAdd = 12;
  else throw new ApiError(400, "Invalid plan");

  const endDate = addMonthsSafe(start, monthsToAdd);

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


  const pt = await Ptbill.create({
    user: userId,
    subscription: [
      {
        plan:plan.duration,
        basePrice:plan.finalPrice,
        finalPrice:final,
        status: "active",
        startDate: start,
        endDate: endDate,
        trainer: trainerId,
        discount: {
      amount: discount || 0,
      code: c?.code || "",
      typeOfDiscount: c?.typeOfCoupon || "none",
      value: c?.value || 0,
    },
        paymentMethod: paymentMethod || "cash",
        ref: ref || ""
      },
    ],
  });
  if (!pt) {
    throw new ApiError(
      500,
      "internal server error, wasn't able to careate pt docuemtn"
    );
  }

  const addM = await Trainer.findByIdAndUpdate(
    trainerId,
    {
      $addToSet: {
        students: { student: userId },
      },
    },
    {
      new: true,
    }
  );
  if (!addM) {
    // add some deletion if faield
    throw new ApiError(400, "wasn't able to update trainer document");
  }

  await Transaction.create({
    user: userId,
    source: "personal-training",
    referenceId:pt._id,
    subReferenceId: pt.subscription[pt.subscription.length - 1]._id,
    amount: final,
    paymentMethod: paymentMethod || "cash",
    status: "success",
    referenceModel:"Ptbill"
  });

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        personalTraning: pt._id,
      },
    },
    {
      new: true,
    }
  );

  try {
    const trainer = await Trainer.findById(trainerId);
    
    await axios.post(process.env.N8N_WEBHOOK_URL, {
      eventType: "pt_assigned",
      memberName: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      plan: plan.duration,
      startDate: start.toISOString(),
      endDate: endDate.toISOString(),
      price: final,
      trainerName: trainer?.fullName || "Your Personal Trainer",
      assignmentDate: new Date().toISOString(),
      trainerEmail:trainer.email,
      trainerPhoneNumber:trainer.phoneNumber
    });
  } catch (error) {
    console.error('Failed to trigger PT assignment email:', error.message);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, pt, "successfully added personal traning"));
});

// thinking to add one more validation , like if the status is active , furuther subscription will not be allowed
// further renewal will only be allowed if and only if the previous subscription is expired
// these all will be asked and then implemented after only conformation
const renewalPtSub = asyncHandler(async (req, res) => {
  const userId = req.params.member_id;
  const user = await User.findById(userId);
  if (!user) throw new ApiError(400, "user wasn't able to found out!");

  const trainerId = req.params.trainer_id;
   const planId = req.params.plan_id;
  const {paymentMethod,ref,startDate,coupon} = req.body;
  const plan = await Plan.findById(planId)

  const c = await Coupon.findOne({code:coupon});
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

  if (!(plan)){
    throw new ApiError(400, "plan Type must required");
  }
  const d = startDate || new Date()
  const start = parseDDMMYYYY(d);
  // stauts will be evaluated via backend
  if (!(plan))
    throw new ApiError(400, "plan Type must required");


  let monthsToAdd = 0;
  if (plan.duration === "monthly") monthsToAdd = 1;
  else if (plan.duration === "quarterly") monthsToAdd = 3;
  else if (plan.duration === "half-yearly") monthsToAdd = 6;
  else if (plan.duration === "yearly") monthsToAdd = 12;
  else throw new ApiError(400, "Invalid plan");

  const endDate = addMonthsSafe(start, monthsToAdd);

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

  const pt = await Ptbill.findByIdAndUpdate(
    user.personalTraning,
    {
      $push: {
        subscription: [
               {
        plan:plan.duration,
        basePrice:plan.finalPrice,
        finalPrice:final,
        status: "active",
        startDate: start,
        endDate: endDate,
        trainer: trainerId,
        discount: {
      amount: discount || 0,
      code: c?.code || "",
      typeOfDiscount: c?.typeOfCoupon || "none",
      value: c?.value || 0,
    },
        paymentMethod: paymentMethod || "cash",
        ref: ref || ""
      },
        ],
      },
    },
    {
      new: true,
    }
  );
  if (!pt) {
    throw new ApiError(
      500,
      "internal server error, wasn't able to careate pt docuemtn"
    );
  }

  // this will be a little critical
  if (trainerId !== pt.subscription[pt.subscription.length - 1].trainer) {
    const addM = await Trainer.findByIdAndUpdate(
      trainerId,
      {
        $addToSet: {
          students: { student: userId },
        },
      },
      {
        new: true,
      }
    );
    if (!addM) {
      // add some deletion if faield
      throw new ApiError(400, "wasn't able to update trainer document");
    }
  }

  await Transaction.create({
    user: userId,
    source: "personal-training",
    referenceId:pt._id,
    subReferenceId: pt.subscription[pt.subscription.length - 1]._id,
    amount: final,
    paymentMethod: paymentMethod || "cash",
    status: "success",
    referenceModel:"Ptbill"
  });

  
  try {
    const trainer = await Trainer.findById(trainerId);
    
    await axios.post(process.env.N8N_WEBHOOK_URL, {
      eventType: "pt_renewal",
      memberName: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      plan: plan.duration,
      startDate: start.toISOString(),
      endDate: endDate.toISOString(),
      price: final,
      trainerName: trainer?.name || "Your Personal Trainer",
      renewalDate: new Date().toISOString(),
      renewalNumber: pt.subscription.length
    });
  } catch (error) {
    console.error('Failed to trigger PT renewal email:', error.message);
  }


  return res
    .status(200)
    .json(new ApiResponse(200, pt, "renewall has been done successfully"));
});

const fetchProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate("subscription")
    .populate({
      path: "personalTraning",
      populate: {
        path: "subscription.trainer",
        model: "Trainer",
        select: "fullName phoneNumber avatar experience",
      },
    });

  if (!user) throw new ApiError(404, "User not found");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "User profile fetched"));
});


export {
  registerUser,
  logOutUser,
  loginUser,
  destroyUser,
  renewalSubscription,
  editUser,
  fetchAllUser,
  fetchParticularUser,
  assignPT,
  renewalPtSub,
  fetchProfile,
  checkUser
};
