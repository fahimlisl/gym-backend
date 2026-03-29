import mongoose,{Schema} from "mongoose"

const paymentInSchema = new mongoose.Schema({
    title: {
      type: String,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    remarks: {
      type: String,
    },
    paymentMethod: {
      type: String,
      enum: ["cash", "upi", "card", "netbanking"],
      default: "cash",
    },
    category:{
        type:String
        // give freedom to choose what category as of now , if asks then go for frontend choosing
    },
    transactionId:{
        type:String // will be only storing if payemnt mehtod is via upi
    },

    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "Admin",
        required: true,
    },
},{timestamps:true})



export const PaymentIn = mongoose.model("PaymentIn",paymentInSchema)