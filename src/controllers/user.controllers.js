import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import generateAccessAndRefreshToken from "../utils/generateANR.js";
import { options } from "../utils/options.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Subscription } from "../models/subscription.models.js";


const registerUser = asyncHandler(async(req,res) => {
    const {username,email,phoneNumber,password} = req.body;
    const {plan , paymentStatus , price} = req.body; // will think whather will access to payment Status
    // pricing will be auto completed via backend ,once gets confirmed

    if(!( plan && price )){
        throw new ApiError(400,"plan and price must required")
        // will change accordingly as per requirement
    }

    if([username,phoneNumber,password].some((t) => !t && t !== 0)){
        throw new ApiError(400,"username , phonenumber and password must required")
    }
    const check = await User.findOne({
        $or:[
            {email},{phoneNumber }
        ]
    })
    if(check) throw new ApiError(400,"user already exits , via same phone number or email")

    const avatarFile = req.file.buffer;
    if(!avatarFile) throw new ApiError(400,"avatar must required")

    const avatarOnCloud = await uploadOnCloudinary(avatarFile)

    if(!avatarOnCloud) {
        throw new ApiError(400,"faield to upload photo on cloudinary")
    }

    const user = await User.create({
        email: email || "",
        phoneNumber,
        username,
        password, // as per now will be given manually , for later can be cahnged , further
        avatar:avatarOnCloud.url
    })

    if(!user) throw new ApiError(500,"internal server error , failed to create user")

    let currentDate = new Date();

    if(plan === "monthly"){
        currentDate.setMonth(currentDate.getMonth() + 1);
    } else if(plan === "quarterly"){
        currentDate.setMonth(currentDate.getMonth() + 3);
    } else if(plan === "half-yearly"){
        currentDate.setMonth(currentDate.getMonth() + 6);
    } else if(plan === "yearly"){
        currentDate.setMonth(currentDate.getMonth() + 12);

    }


    const subscription = await Subscription.create({
        user:user._id,
        plan,
        price,
        startDate: new Date(),
        paymentStatus,
        endDate: currentDate
    })
    
    if(!subscription) {
        await User.findByIdAndDelete(user._id)
        throw new ApiError(400,"internal server error wasn't able to create subscription document and user been deleted successfully")
    }

    const update = await User.findByIdAndUpdate(user._id,
        {
            $set:{
                subscription:subscription._id,
            }
        },
        {
            new:true
        }
    ).populate("subscription")

    if(!update){
        await User.findByIdAndDelete(user._id)
        await Subscription.findByIdAndDelete(subscription._id)
        throw new ApiError(400,"wasn't able to update the id for subscriotion in user document")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            update, // later if need to upgrade to populate with subscription will have to do the same as following
            "user created successfully"
        )
    )
})

const loginUser = asyncHandler(async(req,res) => {
    const {email,phoneNumber,password} = req.body;

    if(!(email || phoneNumber)) throw new ApiError(400,"atleast one field is required")
    if(!password) throw new ApiError(400,"password must required")

    const user = await User.findOne({
        $or:[
            {email},{phoneNumber}
        ]
    }) // can use select to send only resitricted response
    if(!user) throw new ApiError(400,"user wasn't able to found")
    const checkPassword = await user.isPasswordCorrect(password)
    if(!checkPassword) throw new ApiError(400,"crednetials doesn't match")
    
    const {accessToken , refreshToken} = await generateAccessAndRefreshToken(user._id,User)

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            user,
            "user logged in successfully"
        )
    )
})   


const logOutUser = asyncHandler(async(req,res) => {
    const userId = req.user._id;

    const user = await User.findByIdAndUpdate(
        userId,
        {
            $unset:{
                refreshToken: ""
            },
        },
        {
            new:true
        }
    )
    if(!user) throw new ApiError(400,"unauthorized access")
    
    return res
    .status(200)
    .clearCookie("refreshToken",options)
    .clearCookie("accessToken",options)
    .json(
        new ApiResponse(
            200,
            {},
            "user logged out successfully"
        )
    )
    
})


export {registerUser,logOutUser,loginUser}