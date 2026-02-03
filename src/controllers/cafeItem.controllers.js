import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { CafeItem } from "../models/cafeItem.models.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { CafeCart } from "../models/cafeCart.models.js";
import { CafeOrder } from "../models/cafeOrder.models.js";
import { Transaction } from "../models/transaction.models.js";

const addCafeItem = asyncHandler(async (req, res) => {
  const {
    name,
    category,
    description,
    protien,
    carbs,
    price,
    fat,
    isVeg,
    quantity,
    available,
    tags,
    calories,
    purchasePrice,
  } = req.body;
  if (
    [
      name,
      category,
      description,
      protien,
      carbs,
      fat,
      isVeg,
      available,
      tags,
      calories,
      purchasePrice,
      quantity,
    ].some((t) => !t && t !== 0)
  ) {
    throw new ApiError(400, "these fields must required");
  }
  const icheck = await CafeItem.findOne({
    name,
  });

  if (icheck)
    throw new ApiError(
      400,
      "item is already added to databse , kindly delete before adding again"
    );

  const imageU = req.file.buffer;

  const upload = await uploadOnCloudinary(imageU);

  const item = await CafeItem.create({
    name,
    category,
    description,
    macros: {
      protein: protien,
      carbs: carbs,
      fats: fat,
    },
    isVeg,
    available,
    tags,
    price,
    calories,
    purchasePrice,
    quantity,
    image: {
      url: upload.url,
      public_id: upload.public_id,
    },
  });
  if (!item)
    throw new ApiError(
      500,
      "iinternal server error , while creating item to cafe"
    );

  return res
    .status(200)
    .json(new ApiResponse(200, item, "item succesfully added to database!"));
});

const destroyCafeItem = asyncHandler(async (req, res) => {
  const itemId = req.params.id;
  const item = await CafeItem.findByIdAndDelete(itemId);
  if (!item)
    throw new ApiError(
      400,
      "wasn't able to found , the specific item ! and hence deletation is failed"
    );
  await deleteFromCloudinary(item.image.public_id);

  return res
    .status(200)
    .json(
      new ApiResponse(200, item, "item successfully deleted from cloudinary")
    );
});

const editCafeItem = asyncHandler(async (req, res) => {
  const itemId = req.params.id;
  const {
    name,
    category,
    description,
    protien,
    carbs,
    price,
    fat,
    isVeg,
    available,
    tags,
    calories,
  } = req.body;
  if (
    !name &&
    !category &&
    !description &&
    !protien &&
    !carbs &&
    !price &&
    !fat &&
    !isVeg &&
    !available &&
    !tags &&
    !calories
  ) {
    throw new ApiError(400, "at least one field is required to edit item");
  }
  const item = await CafeItem.findById(itemId);
  if (!item) throw new ApiError(400, "wasn't able to find item");
  const update = await CafeItem.findByIdAndUpdate(
    itemId,
    {
      $set: {
        name: name ?? item.name,
        category: category ?? item.category,
        description: description ?? item.description,
        macros: {
          protien: protien ?? item.macros.protein,
          carbs: carbs ?? item.macros.carbs,
          fats: fat ?? item.macros.fats,
        },
        isVeg: isVeg ?? item.isVeg,
        available: available ?? item.available,
        // for as of now not giving tags to be updated
        calories: calories ?? item.calories,
        price: price ?? item.price,
      },
    },
    {
      new: true,
    }
  );

  if (!update)
    throw new ApiError(
      500,
      "internal server error while , updating cafe item deatils"
    );
  return res
    .status(200)
    .json(new ApiResponse(200, update, "cafe item updated successfully"));
});

const fetchAllCafeItems = asyncHandler(async (req, res) => {
  const items = await CafeItem.find({});
  return res
    .status(200)
    .json(
      new ApiResponse(200, items, "all cafe items been succcesfully fetched")
    );
});

const fetchParticularCafeItem = asyncHandler(async (req, res) => {
  const item = await CafeItem.findById(req.params.id);
  if (!item)
    throw new ApiError(
      400,
      "cafe item wasn't able to found , maybe deleted kindly check the whole list"
    );
  return res
    .status(200)
    .json(new ApiResponse(200, item, "cafe item successfully fetched"));
});

const toggleAvailabilty = asyncHandler(async (req, res) => {
  const i = await CafeItem.findById(req.params.id);
  const item = await CafeItem.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        available: !i.available,
      },
    },
    {
      new: true,
    }
  );
  return res
    .status(200)
    .json(new ApiResponse(200, item, "avaialbility toggled successfully"));
});

const addToCart = asyncHandler(async (req, res) => {
  const { itemId, quantity = 1 } = req.body;
  const { paymentMethod } = req.body;
  const adminId = req.user._id; // cafe admin

  let cart = await CafeCart.findOne({ handledBy: adminId });
  let item = await CafeItem.findById(itemId);

  if (!cart) {
    cart = await CafeCart.create({
      handledBy: adminId,
      items: [],
    });
  }

  const existingItem = cart.items.find((i) => i.item.toString() === itemId);

  if (existingItem) {
    existingItem.quantity += quantity;
    cart.totalAmount += item.price * (quantity ? quantity : 1);
    await cart.save();
  } else {
    await CafeCart.findByIdAndUpdate(cart._id, {
      $push: {
        items: {
          item: itemId,
          quantity,
          name: item.name,
          price: item.price,
        },
      },
    });
    await CafeCart.findByIdAndUpdate(
      cart._id,
      {
        $set: {
          totalAmount:
            Number(cart.totalAmount || 0) + Number(item.price) * quantity,
          paymentMethod: paymentMethod || "cash",
        },
      },
      {
        new: true,
      }
    );
  }

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "cart successfully updated"));
});

const removeFromCart = asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  const adminId = req.user._id;

  const cart = await CafeCart.findOne({ handledBy: adminId });
  if (!cart) {
    throw new ApiError(404, "Cart not found");
  }

  const cartItem = cart.items.find(
    (i) => i.item.toString() === itemId
  );

  if (!cartItem) {
    throw new ApiError(404, "Item not found in cart");
  }

  cart.totalAmount -= cartItem.price * cartItem.quantity;

  cart.items = cart.items.filter(
    (i) => i.item.toString() !== itemId
  );

  if (cart.totalAmount < 0) cart.totalAmount = 0;

  await cart.save();

  return res.status(200).json(
    new ApiResponse(
      200,
      cart,
      "Item removed and cart updated successfully"
    )
  );
});

const fetchCart = asyncHandler(async (req, res) => {
  const adminId = req.user._id; // cafe admin

  let cart = await CafeCart.findOne({ handledBy: adminId });

  return res
    .status(200)
    .json(new ApiResponse(200, cart, "cart succesfully being fetched"));
});

const checkout = asyncHandler(async (req, res) => {
  const { paymentMethod, upiRef } = req.body;
  const adminId = req.user._id;

  const cart = await CafeCart.findOne({ handledBy: adminId }).populate(
    "items.item"
  );

  if (!cart || cart.items.length === 0)
    throw new ApiError(400, "Cart is empty");

  const orderItems = cart.items.map((i) => ({
    item: i.item._id,
    quantity: i.quantity,
    name: i.name,
    priceAtPurchase: i.item.price,
  }));

  const order = await CafeOrder.create({
    items: orderItems,
    totalAmount: cart.totalAmount,
    paymentMethod,
    upiRef,
    handledBy: adminId,
  });

  await Transaction.create({
    source: "cafe",
    referenceId: order._id,
    paymentMethod,
    status: "success",
    amount: order.totalAmount,
    referenceModel:"CafeOrder"
  });

  await CafeCart.deleteOne({ _id: cart._id });

  res.json(new ApiResponse(201, order, "Order placed successfully"));
});

const decrementCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  const adminId = req.user._id;

  const cart = await CafeCart.findOne({
    handledBy: adminId,
    "items.item": itemId,
  });

  if (!cart) {
    throw new ApiError(404, "Cart or item not found");
  }

  const cartItem = cart.items.find(
    (i) => i.item.toString() === itemId
  );

  if (!cartItem) {
    throw new ApiError(404, "Item not found in cart");
  }

  if (cartItem.quantity > 1) {
    cartItem.quantity -= 1;
    cart.totalAmount -= cartItem.price;
    await cart.save();
  } 
  else {
    cart.items = cart.items.filter(
      (i) => i.item.toString() !== itemId
    );
    cart.totalAmount -= cartItem.price;
    await cart.save();
  }

  return res.status(200).json(
    new ApiResponse(200, cart, "Item quantity decremented")
  );
});

const incrementCartItem = asyncHandler(async (req, res) => {
  const { itemId } = req.body;
  const adminId = req.user._id;

  const cart = await CafeCart.findOne({
    handledBy: adminId,
    "items.item": itemId,
  });

  if (!cart) {
    throw new ApiError(404, "Cart or item not found");
  }

  const cartItem = cart.items.find(
    (i) => i.item.toString() === itemId
  );

  if (!cartItem) {
    throw new ApiError(404, "Item not found in cart");
  }

  cartItem.quantity += 1;
  cart.totalAmount += cartItem.price;

  await cart.save();

  return res.status(200).json(
    new ApiResponse(200, cart, "Item quantity incremented")
  );
});


export {
  addCafeItem,
  destroyCafeItem,
  editCafeItem,
  fetchAllCafeItems,
  fetchParticularCafeItem,
  toggleAvailabilty,
  addToCart,
  checkout,
  fetchCart,
  removeFromCart,
  decrementCartItem,
  incrementCartItem
};