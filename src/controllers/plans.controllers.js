import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Plan } from "../models/plans.models.js";

const addPlan = asyncHandler(async(req,res) => {
    const {basePrice,finalPrice,title,duration,bio,category
        ,benefits // we will be needing to add benefits to add difreently cuz its a array
    } = req.body;
    if([finalPrice,title,duration,bio,category].some((t) => !t && t !== 0)){
        throw new ApiError(400,"final price , title , duration , bio and benefits are must requried!")
    }
    const p = await Plan.findOne(
        {
            $and:[
                {category},{duration}
            ]
        }
    )

    if(p){
        throw new ApiError(400,`under ${category} ${duration} plan already exists`)
    }


    const plan = await Plan.create({
        category,
        basePrice:basePrice || 0,
        title,
        finalPrice,
        duration,
        bio
    });
    if(!plan) throw new ApiError(400, "internal server error , wasn't able to create the desired plan!");
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            plan,
            "plan has been created successfully"
        )
    )
});

const editPlan = asyncHandler(async(req,res) => {
    const planId = req.params.planId;
    const {basePrice,finalPrice,title,duration,bio
        ,benefits // we will be needing to add benefits to add difreently cuz its a array
    } = req.body;

    const plan = await Plan.findById(planId);
    if(
        !basePrice &&
        !finalPrice &&
        !title &&
        !duration && 
        !bio
    ){
        throw new ApiError("at least one updated field is requied.")
    }

    const updatedPlan = await Plan.findByIdAndUpdate(planId,
        {
            $set:{
                basePrice: basePrice || plan.basePrice || 0,
                finalPrice: finalPrice ?? plan.finalPrice,
                title: title ?? plan.title,
                duration: duration ?? plan.duration,
                bio: bio ?? plan.bio
            }
        },
        {
            new:true
        }
    )

    if(!updatedPlan) {
        throw new ApiError(500,"internal server error , wasn't able to update plan! contact developer");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            updatedPlan,
            "finally plan is updated"
        )
    )
});

const destroyPlan = asyncHandler(async(req,res) => {
    const planId = req.params.planId;
    const plan = await Plan.findByIdAndDelete(planId);
    if(!plan) throw new ApiError(400,"wasn't able to found plan and deletation wasn't possible.");

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "plan has been suscessfully deleted"
        )
    )
});

const addBenefits = asyncHandler(async(req,res) => {
    const planId = req.params.planId;
    const plan = await Plan.findById(planId);
    if(!plan) throw new ApiError(400,"plan wasn't abel to found out");
    const {title} = req.body;
    const p = await Plan.findByIdAndUpdate(planId,
        {
            $push:{
                benefits:{
                    heading:title
                }
            }
        },
        {
            new:true
        }
    );
    if(!p) throw new ApiError(500,"internal server error , wasn't able to add benefit");
    return res
    .status(200)
    .json(
         new ApiResponse(
            200,
            p,
            "benefit has been pushed successfully"
         )
    )
});

const removeBenefits = asyncHandler(async(req,res) => {
    const planId = req.params.planId;
    const subBenefitId = req.params.subBenefitId;

    const plan = await Plan.findByIdAndUpdate(planId,
        {
            $pull:{
                benefits : {_id : subBenefitId }
            }
        },
        {
            new:true
        }
    );

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            plan,
            "removed benefit"
        )
    )
})


const fetchAllPlans = asyncHandler(async(req,res) => {
    const plans = await Plan.find({});
    return res
    .status(200)
    .json(
        new ApiResponse(
        200,
        plans,
        "successfully fetched all plans"
        )
    )
});

const fetchParticularPlan = asyncHandler(async(req,res) => {
    const planId = req.params.planId;
    const plan = await Plan.findById(planId);
    if(!plan) throw new ApiError(400,"plan wasn't able to found!")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            plan,
            "plan has been fetcehd successfully"
        )
    )
})
export { addPlan ,editPlan, destroyPlan , fetchAllPlans, addBenefits ,removeBenefits,fetchParticularPlan}