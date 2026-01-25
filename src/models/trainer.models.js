import mongoose, { Schema } from "mongoose";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const trainerSchema = new mongoose.Schema({
    fullName:{
        type:String,
        required:true
    },
    email:{
        type:String,
    },
    phoneNumber:{
        type:Number,
        required:true
    },
    experience:{
        type:String // will have to edit as per requirments
    },
    password:{
        type:String,
        required:true
    },
    refreshToken:{
        type:String
    },
    // avatar:{
    //     type:String,
    //     required:true
    // },
    avatar:{
        url:{
            type:String,
            required:true
        },
        public_id:{
            type:String,
            required:true
        }
    },
    salary:{
        type:Number
    },
    students:[
        {
            student:{
                type: Schema.Types.ObjectId,
                ref:"User" // user means member
            }
        }
    ]
},{timestamps:true})


trainerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
//   next();
});

trainerSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};


trainerSchema.methods.generateAccessToken = async function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      role: "trainer"
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
      expiresIn: process.env.ACCESS_TOKEN_EXPIRY,
    }
  );
};


trainerSchema.methods.generateRefreshToken = async function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
      expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    }
  );
};




export const Trainer = mongoose.model("Trainer",trainerSchema)