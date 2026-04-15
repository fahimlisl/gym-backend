import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Expense } from "../models/expense.models.js";
import { Transaction } from "../models/transaction.models.js";

const addExpense = asyncHandler(async(req,res) => {
    const {title,amount,remarks,category,transactionId,paymentMethod} = req.body;
    if([
        title,amount,category,paymentMethod
    ].some((t) => !t && t !== 0)){
        throw new ApiError(400,"title , amount , remarks , category , paymentMethod must required to add expense");
    };
    if((paymentMethod === "UPI") && !transactionId){
        throw new ApiError(400,"change payment method or provide upi transaction id")
    };
    const p = paymentMethod.toLowerCase()

    const expense = await Expense.create({
        title,
        amount,
        remarks,
        category,
        transactionId:transactionId || null,
        paymentMethod:p,
        createdBy:req.user._id
    });
    
    if(!expense) throw new ApiError(500,"expense wasn't able to be created, internal server error");

    const trans = await Transaction.create({
        source:"expense",
        amount,
        referenceId:expense._id,
        paymentMethod:p,
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

const fetchEquipmentsExpenses = asyncHandler(async(req,res) => {
    const exp = (await Expense.find({})).filter((t) => t.category === "EQUIPMENT");

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            exp,
            "expense regarding equipments are fetch sucessfully!"
        )
    )
})

const editExpense = asyncHandler(async (req, res) => {
    const expenseId = req.params.id;
    const { title, amount, remarks, category, transactionId, paymentMethod } = req.body;
    if (!title && amount === undefined && !remarks && !category && !paymentMethod) {
        throw new ApiError(400, "At least one field is required to update the expense");
    }

    const existingExpense = await Expense.findById(expenseId);
    if (!existingExpense) throw new ApiError(404, "Expense not found");

    const effectivePaymentMethod = paymentMethod
        ? paymentMethod.toLowerCase()
        : existingExpense.paymentMethod;

    // If final paymentMethod is UPI, a transactionId must exist (new or already stored)
    // if (effectivePaymentMethod === "upi" && !transactionId && !existingExpense.transactionId) {
    //     throw new ApiError(400, "Provide a UPI transaction ID or change the payment method");
    // }

    const updateFields = {};
    if (title)                        updateFields.title = title;
    if (amount !== undefined)         updateFields.amount = amount;
    if (remarks !== undefined)        updateFields.remarks = remarks;
    if (category)                     updateFields.category = category;
    if (paymentMethod)                updateFields.paymentMethod = effectivePaymentMethod;

    if (transactionId)                          updateFields.transactionId = transactionId;
    else if (effectivePaymentMethod !== "upi")  updateFields.transactionId = null; 

    const updatedExpense = await Expense.findByIdAndUpdate(
        expenseId,
        { $set: updateFields },
        { new: true, runValidators: true }
    );

    if (!updatedExpense) throw new ApiError(500, "Failed to update expense, internal server error");

    if (amount !== undefined || paymentMethod) {
        const transactionUpdateFields = {};
        if (amount !== undefined)  transactionUpdateFields.amount = amount;
        if (paymentMethod)         transactionUpdateFields.paymentMethod = effectivePaymentMethod;

        await Transaction.findOneAndUpdate(
            { referenceId: expenseId },
            { $set: transactionUpdateFields }
        );
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedExpense, "Expense updated successfully!"));
});

const destroyExpense = asyncHandler(async(req,res) => {
    const expnseId = req.params.expnseId;
    const e = await Expense.findByIdAndDelete(expnseId);
    if(!e) throw new ApiError(400,"got error while trying to delete expense!!");
    const t = await Transaction.findOneAndDelete({referenceId:expnseId});
    if(!t) throw new ApiError(400,"got error while trying to delete expense transaction!");

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "expnse deleted successfully"
        )
    )
})

export {addExpense,fetchAllExpenses,fetchEquipmentsExpenses,destroyExpense,editExpense}