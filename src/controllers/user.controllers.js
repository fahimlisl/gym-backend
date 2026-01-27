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

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, phoneNumber, password } = req.body;
  const { plan, paymentStatus, price, admissionFee, paymentMethod } = req.body; // will think whather will access to payment Status
  // pricing will be auto completed via backend ,once gets confirmed

  if (!(plan && price)) {
    throw new ApiError(400, "plan and price must required");
    // will change accordingly as per requirement
  }

  if ([username, phoneNumber, password].some((t) => !t && t !== 0)) {
    throw new ApiError(
      400,
      "username , phonenumber and password must required"
    );
  }
  const check = await User.findOne({
    $or: [{ email }, { phoneNumber }],
  });
  if (check)
    throw new ApiError(
      400,
      "user already exits , via same phone number or email"
    );

  const avatarFile = req.file.buffer;
  if (!avatarFile) throw new ApiError(400, "avatar must required");

  const avatarOnCloud = await uploadOnCloudinary(avatarFile);

  if (!avatarOnCloud) {
    throw new ApiError(400, "faield to upload photo on cloudinary");
  }

  const user = await User.create({
    email: email || "",
    phoneNumber,
    username,
    password, // as per now will be given manually , for later can be cahnged , further
    avatar: {
      url: avatarOnCloud.url,
      public_id: avatarOnCloud.public_id,
    },
  });

  if (!user)
    throw new ApiError(500, "internal server error , failed to create user");

  let currentDate = new Date();

  if (plan === "monthly") {
    currentDate.setMonth(currentDate.getMonth() + 1);
  } else if (plan === "quarterly") {
    currentDate.setMonth(currentDate.getMonth() + 3);
  } else if (plan === "half-yearly") {
    currentDate.setMonth(currentDate.getMonth() + 6);
  } else if (plan === "yearly") {
    currentDate.setMonth(currentDate.getMonth() + 12);
  }

  const subPayLoad = {
    plan,
    price,
    startDate: new Date(),
    status: "active",
    paymentStatus: paymentStatus || "paid",
    endDate: currentDate,
  };

  const subscription = await Subscription.create({
    user: user._id,
    admissionFee,
    subscription: [subPayLoad],
  });

  if (!subscription) {
    await User.findByIdAndDelete(user._id);
    throw new ApiError(
      400,
      "internal server error wasn't able to create subscription document and user been deleted successfully"
    );
  }

  const update = await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        subscription: subscription._id,
      },
    },
    {
      new: true,
    }
  ).populate("subscription");

  if (!update) {
    await User.findByIdAndDelete(user._id);
    await Subscription.findByIdAndDelete(subscription._id);
    throw new ApiError(
      400,
      "wasn't able to update the id for subscriotion in user document"
    );
  }

  const transaction = await Transaction.create({
    user: user._id,
    source: "subscription",
    // referenceId: renewal.subscription[renewal.subscription.length - 1]._id,
    referenceId:
      subscription.subscription[subscription.subscription.length - 1]._id,
    amount: parseInt(price) + parseInt(admissionFee),
    paymentMethod: paymentMethod || "cash",
  });

  if (!transaction) {
    await User.findByIdAndDelete(user._id);
    await Subscription.findByIdAndDelete(subscription._id);
    throw new ApiError(400, "wasn't able to create transation record");
  }

  return res.status(200).json(
    new ApiResponse(
      200,
      update, // later if need to upgrade to populate with subscription will have to do the same as following
      "user created successfully"
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

const parseDDMMYYYY = (value) => {
  if (!value) return new Date();

  if (value instanceof Date) return value;

  const [day, month, year] = value.split("/").map(Number);
  return new Date(year, month - 1, day);
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
  const userId = req.params.id;

  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "Member not found");

  const { plan, paymentStatus, price, startDate, paymentMethod } = req.body;

  if (!plan || !price) {
    throw new ApiError(400, "Plan and price are required");
  }
  const start = parseDDMMYYYY(startDate);

  let monthsToAdd = 0;
  if (plan === "monthly") monthsToAdd = 1;
  else if (plan === "quarterly") monthsToAdd = 3;
  else if (plan === "half-yearly") monthsToAdd = 6;
  else if (plan === "yearly") monthsToAdd = 12;
  else throw new ApiError(400, "Invalid plan");

  const endDate = addMonthsSafe(start, monthsToAdd);

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
          paymentStatus: paymentStatus || "paid",
        },
      },
    },
    { new: true }
  );

  if (!renewal) {
    throw new ApiError(400, "Failed to renew subscription");
  }
  const latestSub = renewal.subscription[renewal.subscription.length - 1];

  const transaction = await Transaction.create({
    user: user._id,
    source: "subscription",
    referenceId: latestSub._id,
    amount: price,
    paymentMethod: paymentMethod || "cash",
  });

  if (!transaction) {
    await Subscription.findByIdAndUpdate(renewal._id, {
      $pop: { subscription: 1 },
    });

    throw new ApiError(400, "Failed to generate transaction");
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
  const users = await User.find({});
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
  const user = await User.findById(req.params.id).populate({
    path: "subscription",
  })
  .populate({
    path: "personalTraning",
    populate: {
      path: "subscription.trainer",
      model: "Trainer",
      select: "fullName phoneNumber avatar experience",
    },
  });;
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
    referenceId: pt.subscription[pt.subscription.length - 1]._id,
    amount: price,
    paymentMethod: paymentMethod || "cash",
    status: "success",
  });

  await User.findByIdAndUpdate(
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
  if(trainerId !== pt.subscription[pt.subscription.length - 1].trainer){

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
    referenceId: pt.subscription[pt.subscription.length - 1]._id,
    amount: price,
    paymentMethod: paymentMethod || "cash",
    status: "success",
  });

  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      pt,
      "renewall has been done successfully"
    )
  )

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

  return res.status(200).json(
    new ApiResponse(200, user, "User profile fetched")
  );
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
  fetchProfile
};