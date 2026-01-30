import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { CafeItem } from "../models/cafeItem.models.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";


const addCafeItem = asyncHandler(async(req,res) => {
    const {name , category , description , protien , carbs,price , fat ,isVeg , available , tags,calories} = req.body;
    if([name,category,description,protien,carbs,fat,isVeg,available,tags,calories].some((t) => !t && t !== 0)){
        throw new ApiError(400,"these fields must required")
    }
    const icheck = await CafeItem.findOne({
        name
    })

    if(icheck) throw new ApiError(400,"item is already added to databse , kindly delete before adding again")

    const imageU = req.file.buffer;

    const upload = await uploadOnCloudinary(imageU)

    const item = await CafeItem.create({
        name,
        category,
        description,
        macros:{
            protein:protien,
            carbs:carbs,
            fats:fat
        },
        isVeg,
        available,
        tags,
        price,
        calories,
        image:{
            url:upload.url,
            public_id:upload.public_id
        }
    })
    if(!item) throw new ApiError(500,"iinternal server error , while creating item to cafe");

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            item,
            "item succesfully added to database!"
        )
    )
})

const destroyCafeItem = asyncHandler(async(req,res) => {
    const itemId = req.params.id;
    const item = await CafeItem.findByIdAndDelete(itemId);
    if(!item) throw new ApiError(400,"wasn't able to found , the specific item ! and hence deletation is failed");
    await deleteFromCloudinary(item.image.public_id);


    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            item,
            "item successfully deleted from cloudinary"
        )
    )
});

const editCafeItem = asyncHandler(async(req,res) => {
    const itemId = req.params.id;
    const {name , category , description , protien , carbs,price , fat ,isVeg , available , tags,calories} = req.body;
    if(!name && !category && !description && !protien && !carbs && !price && !fat && !isVeg && !available && !tags && !calories){
        throw new ApiError(400,"at least one field is required to edit item");
    };
    const item = await CafeItem.findById(itemId)
    if(!item) throw new ApiError(400,"wasn't able to find item");
    const update = await CafeItem.findByIdAndUpdate(
        itemId,
        {
            $set:{
                name : name ?? item.name,
                category : category ?? item.category,
                description: description ?? item.description,
                macros:{
                    protien: protien ?? item.macros.protein,
                    carbs: carbs ?? item.macros.carbs,
                    fats:fat ?? item.macros.fats
                },
                isVeg: isVeg ?? item.isVeg,
                available: available ?? item.available,
                // for as of now not giving tags to be updated
                calories: calories ?? item.calories,
                price: price ??  item.price
            }
        },
        {
            new:true
        }
    );

    if(!update) throw new ApiError(500,"internal server error while , updating cafe item deatils");
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            update,
            "cafe item updated successfully"
        )
    )
});

const fetchAllCafeItems = asyncHandler(async(req,res) => {
    const items = await CafeItem.find({})
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            items,
            "all cafe items been succcesfully fetched"
        )
    )
});

const fetchParticularCafeItem = asyncHandler(async(req,res) => {
    const item = await CafeItem.findById(req.params.id);
    if(!item) throw new ApiError(400,"cafe item wasn't able to found , maybe deleted kindly check the whole list");
    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            item,
            "cafe item successfully fetched"
        )
    )
})

const toggleAvailabilty = asyncHandler(async(req,res) => {
    const i = await CafeItem.findById(req.params.id)
    const item = await CafeItem.findByIdAndUpdate(req.params.id,
        {
            $set:{
                available: !(i.available)
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
            item,
            "avaialbility toggled successfully"
        )
    )
})


export {addCafeItem,destroyCafeItem,editCafeItem,fetchAllCafeItems,fetchParticularCafeItem,toggleAvailabilty}