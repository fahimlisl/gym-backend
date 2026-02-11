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

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, phoneNumber, password } = req.body;

  const {
    plan,
    paymentStatus,
    price,
    admissionFee,
    paymentMethod,

    discountType,
    discount,

    discountTypeOnAdFee,
    discountOnAdFee,
  } = req.body;

  if (!(plan && price)) {
    throw new ApiError(400, "plan and price must be provided");
  }

  if ([username, phoneNumber, password].some(v => !v && v !== 0)) {
    throw new ApiError(400, "username, phoneNumber, password are required");
  }

  if (!(discountType && discountTypeOnAdFee)) {
    throw new ApiError(
      400,
      "discountType and discountTypeOnAdFee are required"
    );
  }

  const exists = await User.findOne({
    $or: [{ email }, { phoneNumber }],
  });
  if (exists) {
    throw new ApiError(400, "user already exists");
  }

  const avatarBuffer = req.file?.buffer;
  if (!avatarBuffer) throw new ApiError(400, "avatar is required");

  const avatarOnCloud = await uploadOnCloudinary(avatarBuffer);
  if (!avatarOnCloud) {
    throw new ApiError(400, "failed to upload avatar");
  }

  const user = await User.create({
    username,
    email: email || "",
    phoneNumber,
    password,
    avatar: {
      url: avatarOnCloud.url,
      public_id: avatarOnCloud.public_id,
    },
  });

  if (!user) {
    throw new ApiError(500, "failed to create user");
  }

  const startDate = new Date();
  const endDate = new Date(startDate);

  if (plan === "monthly") endDate.setMonth(endDate.getMonth() + 1);
  if (plan === "quarterly") endDate.setMonth(endDate.getMonth() + 3);
  if (plan === "half-yearly") endDate.setMonth(endDate.getMonth() + 6);
  if (plan === "yearly") endDate.setMonth(endDate.getMonth() + 12);

  let subscriptionDiscountAmount = 0;
  if (discountType === "percentage") {
    subscriptionDiscountAmount = (Number(price) * Number(discount || 0)) / 100;
  } else if (discountType === "flat") {
    subscriptionDiscountAmount = Number(discount || 0);
  }
  let admissionDiscountAmount = 0;

  if (discountTypeOnAdFee === "percentage") {
    admissionDiscountAmount =
      (Number(admissionFee) * Number(discountOnAdFee || 0)) / 100;
  } else if (discountTypeOnAdFee === "flat") {
    admissionDiscountAmount = Number(discountOnAdFee || 0);
  }

  const subPayload = {
    plan,
    price: Number(price),
    startDate,
    endDate,
    status: "active",
    paymentStatus: paymentStatus || "paid",
    discountType,
    discount: Number(discount || 0),
    finalAmount: Number(price) - subscriptionDiscountAmount,
  };

  const subscription = await Subscription.create({
    user: user._id,
    admissionFee: Number(admissionFee),

    discountTypeOnAdFee,
    discountOnAdFee: Number(discountOnAdFee || 0),
    finalAdFee: Number(admissionFee) - admissionDiscountAmount,

    subscription: [subPayload],
  });

  if (!subscription) {
    await User.findByIdAndDelete(user._id);
    throw new ApiError(500, "failed to create subscription");
  }

  await User.findByIdAndUpdate(user._id, {
    $set: { subscription: subscription._id },
  });

  const transaction = await Transaction.create({
    user: user._id,
    source: "subscription",
    // referenceId:
    //   subscription.subscription[
    //     subscription.subscription.length - 1
    //   ]._id,
    referenceId: subscription._id,
    subReferenceId:subscription.subscription[
        subscription.subscription.length - 1
      ]._id,
    amount:
      Number(price) +
      Number(admissionFee) -
      subscriptionDiscountAmount -
      admissionDiscountAmount,

    paymentMethod: paymentMethod || "cash",
    referenceModel:"Subscription"
  });

  if (!transaction) {
    throw new ApiError(500, "failed to create transaction");
  }

  try {
    await axios.post(process.env.N8N_WEBHOOK_URL, {
      eventType: "new_member",
      memberName: username,
      email: email || '',
      phoneNumber: phoneNumber,
      plan: plan,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      price: Number(price),
      admissionFee: Number(admissionFee),
      finalAmount: Number(price) + Number(admissionFee) - subscriptionDiscountAmount - admissionDiscountAmount,
      registrationDate: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to trigger n8n webhook:', error);
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      user,
      "member created successfully"
    )
  );
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, phoneNumber, password } = req.body;

  if (!(email || phoneNumber))
    throw new ApiError(400, "atleast one field is required");
  if (!password) throw new ApiError(400, "password must required");

  const user = await User.findOne({
    $or: [{ email }, { phoneNumber }],
  }); // can use select to send only resitricted response
  if (!user) throw new ApiError(400, "user wasn't able to found");
  const checkPassword = await user.isPasswordCorrect(password);
  if (!checkPassword) throw new ApiError(400, "crednetials doesn't match");

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id,
    User
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(new ApiResponse(200, user, "user logged in successfully"));
});

const logOutUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await User.findByIdAndUpdate(
    userId,
    {
      $unset: {
        refreshToken: "",
      },
    },
    {
      new: true,
    }
  );
  if (!user) throw new ApiError(400, "unauthorized access");

  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, "user logged out successfully"));
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

// const renewalSubscription = asyncHandler(async (req, res) => {
//   const userId = req.params.id;

//   const user = await User.findById(userId);
//   if (!user) throw new ApiError(404, "Member not found");

//   const { plan, paymentStatus, price, startDate, paymentMethod  , discountType, discount,} = req.body;

//   if (!plan || !price) {
//     throw new ApiError(400, "Plan and price are required");
//   }
//   const start = parseDDMMYYYY(startDate);

//   let monthsToAdd = 0;
//   if (plan === "monthly") monthsToAdd = 1;
//   else if (plan === "quarterly") monthsToAdd = 3;
//   else if (plan === "half-yearly") monthsToAdd = 6;
//   else if (plan === "yearly") monthsToAdd = 12;
//   else throw new ApiError(400, "Invalid plan");

//   const endDate = addMonthsSafe(start, monthsToAdd);
//   let subscriptionDiscountAmount = 0;

//   if (discountType === "percentage") {
//     subscriptionDiscountAmount = (Number(price) * Number(discount || 0)) / 100;
//   } else if (discountType === "flat") {
//     subscriptionDiscountAmount = Number(discount || 0);
//   }

//   const renewal = await Subscription.findByIdAndUpdate(
//     user.subscription,
//     {
//       $push: {
//         subscription: {
//           plan,
//           price,
//           startDate: start,
//           endDate,
//           status: "active",
//           discountType,
//           discount: Number(discount || 0),
//           finalAmount: Number(price) - subscriptionDiscountAmount,
//           paymentStatus: paymentStatus || "paid",
//         },
//       },
//     },
//     { new: true }
//   );

//   if (!renewal) {
//     throw new ApiError(400, "Failed to renew subscription");
//   }
//   const latestSub = renewal.subscription[renewal.subscription.length - 1];

//   const transaction = await Transaction.create({
//     user: user._id,
//     source: "subscription",
//     referenceId: renewal._id,
//     // subReferenceId:subscription.subscription[
//     //     subscription.subscription.length - 1
//     //   ]._id,
//     // referenceId: latestSub._id,
//     subReferenceId:latestSub,
//     amount: Number(price) - subscriptionDiscountAmount,
//     paymentMethod: paymentMethod || "cash",
//     referenceModel:"Subscription"
//   });

//   if (!transaction) {
//     await Subscription.findByIdAndUpdate(renewal._id, {
//       $pop: { subscription: 1 },
//     });

//     throw new ApiError(400, "Failed to generate transaction");
//   }

//   try {
//     await axios.post(process.env.N8N_WEBHOOK_URL, {
//       eventType: "subscription_renewal",
//       memberName: user.username,
//       email: user.email,
//       phoneNumber: user.phoneNumber,
//       plan: plan,
//       startDate: start.toISOString(),
//       endDate: endDate.toISOString(),
//       finalAmount: Number(price) - subscriptionDiscountAmount,
//       renewalDate: new Date().toISOString(),
//       renewalNumber: renewal.subscription.length
//     });
//   } catch (error) {
//     console.error('Failed to trigger renewal email:', error.message);
//   }

//   return res
//     .status(200)
//     .json(new ApiResponse(200, renewal, "Renewal completed successfully"));
// });
const renewalSubscription = asyncHandler(async (req, res) => {
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "Member not found");

  const { plan, paymentStatus, price, startDate, paymentMethod, discountType, discount } = req.body;

  if (!plan || !price) {
    throw new ApiError(400, "Plan and price are required");
  }

  // Use today's date if startDate is not provided
  let start;
  if (!startDate) {
    start = new Date(); // Default to today
  } else {
    start = parseDDMMYYYY(startDate);
    
    // Check if parseDDMMYYYY returned a valid date
    if (!start || isNaN(start.getTime())) {
      throw new ApiError(400, "Invalid start date format");
    }
  }

  let monthsToAdd = 0;
  if (plan === "monthly") monthsToAdd = 1;
  else if (plan === "quarterly") monthsToAdd = 3;
  else if (plan === "half-yearly") monthsToAdd = 6;
  else if (plan === "yearly") monthsToAdd = 12;
  else throw new ApiError(400, "Invalid plan");

  const endDate = addMonthsSafe(start, monthsToAdd);
  
  // Validate endDate
  if (!endDate || isNaN(endDate.getTime())) {
    throw new ApiError(400, "Failed to calculate end date");
  }

  let subscriptionDiscountAmount = 0;

  if (discountType === "percentage") {
    subscriptionDiscountAmount = (Number(price) * Number(discount || 0)) / 100;
  } else if (discountType === "flat") {
    subscriptionDiscountAmount = Number(discount || 0);
  }

  const renewal = await Subscription.findByIdAndUpdate(
    user.subscription,
    {
      $push: {
        subscription: {
          plan,
          price,
          startDate: start,
          endDate,
          status: "active",
          discountType,
          discount: Number(discount || 0),
          finalAmount: Number(price) - subscriptionDiscountAmount,
          paymentStatus: paymentStatus || "paid",
        },
      },
    },
    { new: true }
  );

  if (!renewal) {
    throw new ApiError(400, "Failed to renew subscription");
  }

  // marking isActive to true for user model 
  await User.findByIdAndUpdate(userId,
    {
      $set:{
        isActive:true
      }
    },
    {
      new:true
    }
  )
  
  const latestSub = renewal.subscription[renewal.subscription.length - 1];

  const transaction = await Transaction.create({
    user: user._id,
    source: "subscription",
    referenceId: renewal._id,
    subReferenceId: latestSub,
    amount: Number(price) - subscriptionDiscountAmount,
    paymentMethod: paymentMethod || "cash",
    referenceModel: "Subscription"
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
      plan: plan,
      startDate: start.toISOString(),
      endDate: endDate.toISOString(),
      finalAmount: Number(price) - subscriptionDiscountAmount,
      renewalDate: new Date().toISOString(),
      renewalNumber: renewal.subscription.length
    });
  } catch (error) {
    console.error('Failed to trigger renewal email:', error.message);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, renewal, "Renewal completed successfully"));
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
  const { plan, price, startDate, status, paymentMethod } = req.body;
  // stauts will be evaluated via backend
  if (!(plan || price))
    throw new ApiError(400, "planType and price must required");

  const start = parseDDMMYYYY(startDate);
  if (!start) {
  throw new ApiError(
    400,
    "Invalid startDate. Use DD/MM/YYYY or YYYY-MM-DD"
  );
}

  let monthsToAdd = 0;
  if (plan === "monthly") monthsToAdd = 1;
  else if (plan === "quarterly") monthsToAdd = 3;
  else if (plan === "half-yearly") monthsToAdd = 6;
  else if (plan === "yearly") monthsToAdd = 12;
  else throw new ApiError(400, "Invalid plan");

  const endDate = addMonthsSafe(start, monthsToAdd);

  const pt = await Ptbill.create({
    user: userId,
    subscription: [
      {
        plan,
        price,
        status: status || "active",
        startDate: start,
        endDate: endDate,
        trainer: trainerId,
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
    // referenceId: pt.subscription[pt.subscription.length - 1]._id,
    referenceId:pt._id,
    subReferenceId: pt.subscription[pt.subscription.length - 1]._id,
    amount: price,
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
      plan: plan,
      startDate: start.toISOString(),
      endDate: endDate.toISOString(),
      price: price,
      trainerName: trainer?.fullName || "Your Personal Trainer",
      assignmentDate: new Date().toISOString()
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

  const { plan, price, startDate, status, paymentMethod } = req.body;
  // stauts will be evaluated via backend
  if (!(plan || price))
    throw new ApiError(400, "planType and price must required");

  const start = parseDDMMYYYY(startDate);

  let monthsToAdd = 0;
  if (plan === "monthly") monthsToAdd = 1;
  else if (plan === "quarterly") monthsToAdd = 3;
  else if (plan === "half-yearly") monthsToAdd = 6;
  else if (plan === "yearly") monthsToAdd = 12;
  else throw new ApiError(400, "Invalid plan");

  const endDate = addMonthsSafe(start, monthsToAdd);

  const pt = await Ptbill.findByIdAndUpdate(
    user.personalTraning,
    {
      $push: {
        subscription: [
          {
            plan,
            price,
            status: status || "active",
            startDate: start,
            endDate: endDate,
            trainer: trainerId,
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
    amount: price,
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
      plan: plan,
      startDate: start.toISOString(),
      endDate: endDate.toISOString(),
      price: price,
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
};
