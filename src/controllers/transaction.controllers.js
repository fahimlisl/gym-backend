import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Transaction } from "../models/transaction.models.js";

const fetchAllTransactions = asyncHandler(async(req,res) => {
    const trans = await Transaction.find({})
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
    console.log(total)

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



export {fetchAllTransactions,calculateTotalInLet}