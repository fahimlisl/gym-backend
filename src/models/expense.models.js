import mongoose,{Schema} from "mongoose";

const expenseSchema = new mongoose.Schema(
  {
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
    transactionId:{
        type:String // will be only storing if payemnt mehtod is via upi
    },
    category: {
      type: String,
      enum: [
        "RENT",
        "SALARY",
        "ELECTRICITY",
        "WATER",
        "EQUIPMENT",
        "MAINTENANCE",
        "MARKETING",
        "INTERNET",
        "ETC",
      ],
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    }, // incase there can be 3 admins , so for to maintian , which one is handling
  },
  { timestamps: true }
);

export const Expense = mongoose.model("Expense", expenseSchema);
