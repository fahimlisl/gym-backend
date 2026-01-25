import mongoose,{Schema} from "mongoose";
// needs modificaition here , as like storing it inside an array for pushing , whenever needs to renew personal traninng
const ptillSchema = new mongoose.Schema({
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

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
  },
  { timestamps: true }
);

export const Ptbill = mongoose.model("Ptbill",ptillSchema)