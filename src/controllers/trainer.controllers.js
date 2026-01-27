import { Trainer } from "../models/trainer.models.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import generateAccessAndRefreshToken from "../utils/generateANR.js";
import { options } from "../utils/options.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.models.js";

const registerTrainer = asyncHandler(async (req, res) => {
  const { fullName, email, phoneNumber, password, experience , salary} = req.body;
  if (
    [fullName, phoneNumber, password, experience,salary].some((t) => !t && t !== 0)
  ) {
    throw new ApiError(400, "each field is required");
  }

  const check = await Trainer.findOne({
    $or: [{ email }, { phoneNumber }],
  });

  if (check)
    throw new ApiError(
      400,
      "trainier already exists vai same phone number or email id"
    );

  const avatar = req.file.buffer;
  if (!avatar) throw new ApiError(400, "avatar must required");

  const avatarOnCloud = await uploadOnCloudinary(avatar);
  if (!avatarOnCloud)
    throw new ApiError(400, "avatar wasn't able to upload on cloudianry");
  const trainer = await Trainer.create({
    fullName,
    email,
    phoneNumber,
    password,
    experience,
    avatar:{
        url:avatarOnCloud.url,
        public_id:avatarOnCloud.public_id
    },
    salary 
  });
  if(!trainer) throw new ApiError(500,"internal server erorr , wasn't able to create trainer")

  return res
  .status(200)  
  .json(
    new ApiResponse(
        200,
        trainer,
        "trainer created successfully"
    )
  )
});

const loginTrainier = asyncHandler(async(req,res) => {
    const {email, phoneNumber, password} = req.body;
    if(!(email || phoneNumber)){
        throw new ApiError(400,"email or phone number required")
    }
    const check = await Trainer.findOne({
        $or:[
            {email},{phoneNumber}
        ]
    })
    if(!check) {
        throw new ApiError(400,"trainer wasn't able to found")
    }
    if(!password) {
        throw new ApiError(400,"password must requied")
    }
    const checkPassword = await check.isPasswordCorrect(password)

    if(!checkPassword) {
        throw new ApiError(400,"password didn't match , invalid crednetials")
    }
    const {accessToken, refreshToken} = await generateAccessAndRefreshToken(check._id,Trainer);

     return res
    .status(200)
    .cookie("refreshToken", refreshToken, options)
    .cookie("accessToken", accessToken, options)
    .json(
      new ApiResponse(
        200,
        check,
        "trainer logged in successfully"
      )
    );
})

const logOutTrainer = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  if (!userId) {
    throw new ApiError(
      400,
      "userId wasn't able to found , unauthroized access"
    );
  }
  const user = await Trainer.findById(req.user._id);
  if (!user) {
    throw new ApiError(
      400,
      "user isn't logged in yet , or unauthorized access"
    );
  }
  await Trainer.findByIdAndUpdate(
    req.user._id,
    {
      $unset: { refreshToken: "" },
    },
    {
      new: true,
    }
  );

  return res
    .status(200)
    .clearCookie("refreshToken", options)
    .clearCookie("accessToken", options)
    .json(new ApiResponse(200, {}, `admin logged out successfully`));
});


const editTrainer = asyncHandler(async(req,res) => {
    const { fullName, email, phoneNumber, experience , salary} = req.body;
    const trainerId = req.params.id;
  if (
    !(fullName || email || phoneNumber || experience || salary)
  ) {
    throw new ApiError(400, "at least one field is required");
  }

  const check = await Trainer.findById(trainerId)
  if(!check) {
    throw new ApiError(400,"trainer wasn't able to found")
  }
  const update = await Trainer.findByIdAndUpdate(check._id,
    {
        $set:{
            fullName:fullName || check.fullName,
            email : email || check.email,
            phoneNumber: phoneNumber || check.phoneNumber,
            experience : experience || check.experience,
            salary: salary || check.salary
        }
    },
    {
        new:true
    }
  )

  if(!update){
    throw new ApiError(500,"internal server error , failed to updatetrainer")
  }

  return res
  .status(200)
  .json(
    new ApiResponse(
        200,
        update,
        "trainer deatils have been updated successfully"
    )
  )
})

const destroyTrainer = asyncHandler(async(req,res) => {
    const trainerId = req.params.id;
    const del = await Trainer.findByIdAndDelete(trainerId)
    if(!del){
        throw new ApiError(400,"failed to delete trianer")
    }

    const delAvatar = await deleteFromCloudinary(del.avatar.public_id);
    if(!delAvatar){
        throw new ApiError(400,"failed to delete avatar of trainer")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "trainer have been successfully deleted"
        )
    )
})

const fetchAllTrainer = asyncHandler(async(req,res) => {
    const trainers = await Trainer.find({}).select("-password -refreshToken")
    if(!trainers){
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "no trainers been added yet"
            )
        )
    }
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            trainers,
            "trainers been successfully fetched"
        )
    )
})

const fetchParticularTrainer = asyncHandler(async(req,res) => {
    const trainerId = req.params.id;
    const trainer = await Trainer.findById(trainerId).select("-password -refreshToken");
    if(!trainer) throw new ApiError(400,"trainer wasn't able to found regarding this id");
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            trainer,
            "trainer fetched successfully"
        )
    )
})

const fetchAssignedStudents = asyncHandler(async(req,res) => {
  const trainerId = req.user._id;
  const trainer = await Trainer.findById(trainerId)
  let stud = []
  for(let i = 0 ; i <= trainer.students.length - 1 ; i++ ){
    // if(trainer.students[i].student !== )
    stud.push(trainer.students[i].student)
  }
  let stss = []
  for(let i = 0 ; i<= trainer.students.length - 1 ; i++){

    const s = await User.findById(stud[i])
    stss.push(s)
  }

  // one bug , is that , if one member is gettingmutople subs , gettinig fetch mutipl time , bt not rqrqwueid
  
  return res
  .status(200)
  .json(
    new ApiResponse(
      200,
      stss,
      "successfully fetched all the members"
    )
  )
})



export {logOutTrainer,loginTrainier,registerTrainer}
export{editTrainer,destroyTrainer,fetchAllTrainer,fetchParticularTrainer,fetchAssignedStudents}