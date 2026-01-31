import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Transaction } from "../models/transaction.models.js";

const fetchAllTransactions = asyncHandler(async(req,res) => {
    const trans = await Transaction.find({})
    .sort({ createdAt: -1 });
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            trans,
            "sucessfully fetched all transactions"
        )
    )
})


const calculateTotalInLet = asyncHandler(async(req,res) => {
    const trans = await Transaction.find({})
    let total = 0;
    for(let i = 0 ; i <= trans.length - 1 ; i++){
        total = total + trans[i].amount
    }

    // category wise calculation will be done also

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            total,
            "total calculation have been done successfully"
        )
    )

})

// starting of calculation for weekly , daily , and monthly revenew chart

const getStartOfDay = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfWeek = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

const getStartOfYear = () => {
  const d = new Date();
  d.setMonth(0, 1);
  d.setHours(0, 0, 0, 0);
  return d;
};


const calculateStats = async (startDate) => {
  const result = await Transaction.aggregate([
    {
      $match: {
        status: "success",
        paidAt: { $gte: startDate },
      },
    },
    {
      $group: {
        _id: null,
        totalAmount: { $sum: "$amount" },
        totalTransactions: { $sum: 1 },
      },
    },
  ]);

  return {
    totalAmount: result[0]?.totalAmount || 0,
    totalTransactions: result[0]?.totalTransactions || 0,
  };
};

const fetchDashboardRevenue = asyncHandler(async (req, res) => {
  const today = await calculateStats(getStartOfDay());
  const weekly = await calculateStats(getStartOfWeek());
  const monthly = await calculateStats(getStartOfMonth());
  const yearly = await calculateStats(getStartOfYear());

  return res.status(200).json(
    new ApiResponse(200, {
      today,
      weekly,
      monthly,
      yearly,
    }, "dashboard revenue fetched successfully")
  );
});


const fetchRevenueBySource = asyncHandler(async (req, res) => {
  const data = await Transaction.aggregate([
    { $match: { status: "success" } },
    {
      $group: {
        _id: "$source",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
  ]);

  return res.status(200).json(
    new ApiResponse(200, data, "source wise revenue fetched")
  );
});


const fetchRecentTransactions = asyncHandler(async (req, res) => {
  const txns = await Transaction.find({ status: "success" })
    .sort({ paidAt: -1 })
    .limit(20)   // will be for a day , doesn't matter how much
    .populate("user", "username phoneNumber");

  return res.status(200).json(
    new ApiResponse(200, txns, "recent transactions fetched")
  );
});

export {
  fetchDashboardRevenue,
  fetchRevenueBySource,
  fetchRecentTransactions,
};




export {fetchAllTransactions,calculateTotalInLet}