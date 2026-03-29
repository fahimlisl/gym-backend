import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { PaymentIn } from "../models/paymentin.models.js";
import { Transaction } from "../models/transaction.models.js";

const addPaymentIn = asyncHandler(async (req, res) => {
  const { title, amount, remarks, paymentMethod, category, transactionId } = req.body;

  if ([title, remarks].some((t) => !t?.toString().trim())) {
    throw new ApiError(400, "Title and remarks are required!");
  }
  if (amount === undefined || amount === null || isNaN(amount)) {
    throw new ApiError(400, "A valid amount is required!");
  }

  const pay = await PaymentIn.create({
    title: title.trim(),
    amount,
    remarks: remarks.trim(),
    paymentMethod: paymentMethod || "cash",
    category: category || undefined,
    transactionId: transactionId || undefined,
    createdBy: req.user._id, 
  });

  if (!pay) throw new ApiError(500, "Failed to create payment. Contact administrator!");

  const trans = await Transaction.create({
    source: "paymentin",
    referenceModel: "PaymentIn",
    referenceId: pay._id,
    amount,
    status: "success",
    paymentMethod: paymentMethod || "cash",
  });

  if (!trans) throw new ApiError(500, "Failed to create transaction document!");

  return res
    .status(201)
    .json(new ApiResponse(201, pay, "Payment created successfully!"));
});


const editPaymentIn = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, amount, remarks, paymentMethod, category, transactionId } = req.body;

  const pay = await PaymentIn.findById(id);
  if (!pay) throw new ApiError(404, "Payment record not found!");

  if (title !== undefined) pay.title = title.trim();
  if (amount !== undefined) {
    if (isNaN(amount)) throw new ApiError(400, "Invalid amount!");
    pay.amount = amount;
  }
  if (remarks !== undefined) pay.remarks = remarks.trim();
  if (paymentMethod !== undefined) pay.paymentMethod = paymentMethod;
  if (category !== undefined) pay.category = category;
  if (transactionId !== undefined) pay.transactionId = transactionId;

  await pay.save();

  if (amount !== undefined) {
    await Transaction.findOneAndUpdate(
      { referenceId: pay._id, referenceModel: "PaymentIn" },
      { amount, paymentMethod: pay.paymentMethod }
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, pay, "Payment updated successfully!"));
});


const deletePaymentIn = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const pay = await PaymentIn.findById(id);
  if (!pay) throw new ApiError(404, "Payment record not found!");

  await PaymentIn.findByIdAndDelete(id);

  await Transaction.findOneAndDelete({
    referenceId: pay._id,
    referenceModel: "PaymentIn",
  });

  return res
    .status(200)
    .json(new ApiResponse(200, null, "Payment deleted successfully!"));
});

export { addPaymentIn, editPaymentIn, deletePaymentIn };