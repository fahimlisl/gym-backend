import mongoose, { Schema } from "mongoose";

const foodSchema = new mongoose.Schema(
  {
    photo:{
      type:String,
    },
    public_id:{
      type:String
    }
  },
  { _id: true }
);

const dietSchema = new mongoose.Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "approved"],
      default: "draft",
    },

    photos:{
      type:[foodSchema]
    }
  },
  { timestamps: true }
);


export const Diet = mongoose.model("Diet", dietSchema);
