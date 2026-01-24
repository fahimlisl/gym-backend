import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Supplement } from "../models/supplement.models.js";
import {uploadOnCloudinary} from "../utils/cloudinary.js"

const addSupplement = asyncHandler(async(req,res) => {
    const {productName,category,price,description} = req.body;
    if(
        [
            productName,
            category,
            price,
            description
        ].some((t) => !t && t !== 0 ) 
    ){
        throw new ApiError(400,"all fileds are required")
    }

    const check = await Supplement.findOne({productName})
    if(check) throw new ApiError(400,"product already exits")

    const images = []

    for(let i = 0 ; i < req.files.length ; i++ ){
        const image = await uploadOnCloudinary(req.files[i].buffer)
        images.push(image)
    }

    const image = images.map((file,index) => ({
        url:file.url,
        isThumbnail : index === 0
    }))

    const supp = await Supplement.create({
        productName,
        price,
        description,
        images:image,
        category
    })

    if(!supp) throw new ApiError(500,"wasn't able to add supplement , internal server error")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            supp,
            "supplement successfully added"
        )
    )
})


export {addSupplement}