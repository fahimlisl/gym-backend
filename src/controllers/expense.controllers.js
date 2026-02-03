import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Expense } from "../models/expense.models.js";
import { Transaction } from "../models/transaction.models.js";

const addExpense = asyncHandler(async(req,res) => {
    const {title,amount,remarks,category,transactionId,paymentMethod} = req.body;
    if([
        title,amount,remarks,category,paymentMethod
    ].some((t) => !t && t !== 0)){
        throw new ApiError(400,"title , amount , remarks , category , paymentMethod must required to add expense");
    };
    if((paymentMethod === "UPI") && !transactionId){
        throw new ApiError(400,"change payment method or provide upi transaction id")
    };
    const expense = await Expense.create({
        title,
        amount,
        remarks,
        category,
        transactionId:transactionId || null,
        paymentMethod,
        createdBy:req.user._id
    });
    
    if(!expense) throw new ApiError(500,"expense wasn't able to be created, internal server error");

    const trans = await Transaction.create({
        source:"expense",
        amount,
        referenceId:expense._id,
        paymentMethod,
        referenceModel:"Expense",
        status:"success",
        user:req.user._id
    });

    if(!trans) throw new ApiError(500,"internal server error , wasn't able to add transaction")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            expense,
            "expense added successfully!"
        )
    )

});

const fetchAllExpenses = asyncHandler(async(req,res) => {
    const exp = await Expense.find({});

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            exp,
            "expenses been successfully fetched"
        )
    )
})

export {addExpense,fetchAllExpenses}