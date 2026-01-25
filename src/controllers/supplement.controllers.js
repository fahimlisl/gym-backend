import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Supplement } from "../models/supplement.models.js";
import {deleteFromCloudinary, uploadOnCloudinary} from "../utils/cloudinary.js"

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
        isThumbnail : index === 0,
        public_id: file.public_id
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

const editSupplement = asyncHandler(async(req,res) => {
    const {productName,category,price,description} = req.body;
    const productId = req.params.id;
    if(
        !(productName || category || price || description)
    ){
        throw new ApiError(400,"all fileds are required")
    }

    const check = await Supplement.findById(productId)
    if(!check) throw new ApiError(400,"product wasn't able to found in database")
    
    const update = await Supplement.findByIdAndUpdate(check._id,
        {
            $set:{
                productName:productName || check.productName,
                category: category || check.category,
                price: price || check.category,
                description: description || check.description
            }
        },
        {
            new:true
        }
    )

    if(!update) throw new ApiError(500,"internal server error , wasn't able to update")


    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            update,
            "supplement updated successfully"
        )
    )
    
})

// also have to add a fucntionality where will be only deleting a single particular image via selecting or , thinking to add the fucntionaly here under update thign ,,,,,,,, lets see

const destroySupplement = asyncHandler(async(req,res) => {
    const productId = req.params.id;
    const supp = await Supplement.findByIdAndDelete(productId)
    if(!supp) throw new ApiError(400,"wasn't able to delete supplement") 

    for(let i = 0; i < supp.images.length ; i++){
        const del = await deleteFromCloudinary(supp.images[i].public_id)
    }
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            {},
            "product and assiociated images been deleted successfully"
        )
    )
})

const fetchAllSupp = asyncHandler(async(req,res) => {
    const supp = await Supplement.find({});
    if(supp.length === 0){
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "till now no supplements are added yet"
            )
        )
    }

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            supp,
            "successfully fetched all supplements"
        )
    )
});

const fetchParticularSupp = asyncHandler(async(req,res) => {
    const productId = req.params.id;
    const product = await Supplement.findById(productId)
    if(!product) throw new ApiError(400,"product wasn't able to found")
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            product,
            "product successfully fetched"
        )
    )
})


export {addSupplement,editSupplement,destroySupplement}
export {fetchAllSupp,fetchParticularSupp}