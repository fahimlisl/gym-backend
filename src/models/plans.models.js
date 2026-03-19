import mongoose from "mongoose";

const benefitsSchmea = new mongoose.Schema({
    heading:{
        type:String,
        required:true,
        // unique:true
    }
},{timestamps:false})

const planSchema = new mongoose.Schema({
    category:{
        type:String,
        enum:["SUBSCRIPTION","PT"]
    }, 
    title:{
        type:String
    },
    basePrice:{
        type:Number
        // will be using to refelct things!
    },
    finalPrice:{ // this will be final price after providing discount!
        type:Number,
        required:true,
        // unique:true
    },
    duration:{
        type:String,
        // enum:["Monthly","Quaterly","Yearly","Half-Yearly"],
        enum:["monthly","quarterly","yearly","half-yearly"],
    },
    bio:{
        type:String
    },
    benefits:{
        type:[benefitsSchmea]
    }

},{timestamps:true})


export const Plan = mongoose.model("Plan",planSchema)