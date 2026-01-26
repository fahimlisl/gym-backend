import mongoose,{Schema} from "mongoose";

const regularSchema = new mongoose.Schema({
  trainer: {
      type: Schema.Types.ObjectId,
      ref: "Trainer",
      required: true,
    },

    plan: {
      type: String,
      enum: ["monthly", "quarterly", "half-yearly", "yearly"],
      required: true,
    },

    startDate: {
      type: Date,
      required: true,
      default: Date.now,
    },

    endDate: {
      type: Date,
    },

    status: {
      type: String,
      enum: ["active","paused", "expired"], // will use pause if starts at a particular date
      default: "active",
    },

    price: {
      type: Number,
      required: true,
    },
},{timestamps:true})

const ptillSchema = new mongoose.Schema({
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscription:{
      type:[regularSchema]
    }
    
  },
  { timestamps: true }
);

export const Ptbill = mongoose.model("Ptbill",ptillSchema)