import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Supplement } from "../models/supplement.models.js";
import { deleteFromCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { SupplementBill } from "../models/supplementBill.models.js";
import { User } from "../models/user.models.js";
import { Coupon } from "../models/coupon.models.js";
import {Transaction} from "../models/transaction.models.js"

const addSupplement = asyncHandler(async (req, res) => {
  const { productName, category, salePrice, purchasePrice, quantity, description, barcode } = req.body;
  
  if (
    [productName, category, salePrice, purchasePrice, quantity, description].some(
      (field) => field === undefined || field === null || field === ""
    )
  ) {
    throw new ApiError(400, "All required fields are required");
  }

  if (quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }
  if (salePrice <= 0 || purchasePrice <= 0) {
    throw new ApiError(400, "Prices must be greater than 0");
  }

  const check = await Supplement.findOne({ productName });
  if (check) throw new ApiError(400, "Product already exists");

  const images = [];

  if (req.files && req.files.length > 0) {
    for (let i = 0; i < req.files.length; i++) {
      const image = await uploadOnCloudinary(req.files[i].buffer);
      images.push(image);
    }
  }

  const imageData = images.map((file, index) => ({
    url: file.url,
    isThumbnail: index === 0,
    public_id: file.public_id,
  }));

  const supp = await Supplement.create({
    productName,
    category,
    salePrice,
    purchasePrice,
    quantity,
    description,
    barcode: barcode || null,
    images: imageData,
  });

  if (!supp) {
    throw new ApiError(500, "Wasn't able to add supplement, internal server error");
  }

  return res.status(200).json(
    new ApiResponse(200, supp, "Supplement successfully added")
  );
});

const editSupplement = asyncHandler(async (req, res) => {
  const { productName, category, salePrice, purchasePrice, quantity, description, barcode } = req.body;
  const productId = req.params.id;

  if (
    !(productName || category || salePrice || purchasePrice || quantity || description || barcode)
  ) {
    throw new ApiError(400, "At least one field is required for update");
  }

  const check = await Supplement.findById(productId);
  if (!check) {
    throw new ApiError(400, "Product wasn't found in database");
  }

  if (salePrice && salePrice <= 0) {
    throw new ApiError(400, "Sale price must be greater than 0");
  }
  if (purchasePrice && purchasePrice <= 0) {
    throw new ApiError(400, "Purchase price must be greater than 0");
  }
  if (quantity && quantity <= 0) {
    throw new ApiError(400, "Quantity must be greater than 0");
  }

  const updateData = {
    productName: productName || check.productName,
    category: category || check.category,
    salePrice: salePrice || check.salePrice,
    purchasePrice: purchasePrice || check.purchasePrice,
    quantity: quantity || check.quantity,
    description: description || check.description,
    barcode: barcode !== undefined ? barcode : check.barcode,
  };

  const update = await Supplement.findByIdAndUpdate(
    productId,
    { $set: updateData },
    { new: true }
  );

  if (!update) {
    throw new ApiError(500, "Internal server error, wasn't able to update");
  }

  return res.status(200).json(
    new ApiResponse(200, update, "Supplement updated successfully")
  );
});

const destroySupplement = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  
  const supp = await Supplement.findByIdAndDelete(productId);
  if (!supp) {
    throw new ApiError(400, "Wasn't able to delete supplement");
  }

  if (supp.images && supp.images.length > 0) {
    for (let i = 0; i < supp.images.length; i++) {
      await deleteFromCloudinary(supp.images[i].public_id);
    }
  }

  return res.status(200).json(
    new ApiResponse(200, {}, "Product and associated images deleted successfully")
  );
});

const fetchAllSupp = asyncHandler(async (req, res) => {
  const supp = await Supplement.find({});
  
  if (supp.length === 0) {
    return res.status(200).json(
      new ApiResponse(200, [], "No supplements added yet")
    );
  }

  return res.status(200).json(
    new ApiResponse(200, supp, "Successfully fetched all supplements")
  );
});

const fetchParticularSupp = asyncHandler(async (req, res) => {
  const productId = req.params.id;
  
  const product = await Supplement.findById(productId);
  if (!product) {
    throw new ApiError(400, "Product wasn't found");
  }

  return res.status(200).json(
    new ApiResponse(200, product, "Product successfully fetched")
  );
});

export const validateSupplementCoupon = async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: "Coupon code required" });
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      category: "SUPPLEMENT",
      isActive: true,
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid or inactive coupon" });
    }

    if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
      return res.status(400).json({ success: false, message: "Coupon has expired" });
    }

    if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
    }

    if (coupon.minCartAmount && cartTotal < coupon.minCartAmount) {
      return res.status(400).json({
        success: false,
        message: `Minimum cart amount of ₹${coupon.minCartAmount} required`,
      });
    }

    let discountAmount = 0;
    if (coupon.typeOfCoupon === "percentage") {
      discountAmount = (cartTotal * coupon.value) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else if (coupon.typeOfCoupon === "flat") {
      discountAmount = coupon.value;
    }

    discountAmount = Math.min(discountAmount, cartTotal);

    return res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      coupon: {
        code: coupon.code,
        typeOfCoupon: coupon.typeOfCoupon,
        value: coupon.value,
        discountAmount,
        finalTotal: cartTotal - discountAmount,
      },
    });
  } catch (error) {
    console.error("validateSupplementCoupon error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


const checkoutSupplements = async (req, res) => {
  try {
    const {
      cart,
      customerInfo,
      couponCode,
      paymentMethod = "razorpay", 
      notes,
      subtotal,
    } = req.body;

    console.log("Checkout request:", { cart, customerInfo, couponCode, paymentMethod, subtotal });

    if (!cart || cart.length === 0) {
      return res.status(400).json({ success: false, message: "Cart is empty" });
    }
    if (!customerInfo?.phoneNumber) {
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    let user = null;
    let isGuest = false;
    
    if (customerInfo.userId) {
      user = await User.findById(customerInfo.userId);
      isGuest = !user;
    } 
    else if (customerInfo.phoneNumber) {
      user = await User.findOne({ phoneNumber: customerInfo.phoneNumber });
      isGuest = !user;
    }
    
    if (isGuest && !customerInfo.fullName) {
      return res.status(400).json({
        success: false,
        message: "Full name required for guest order",
      });
    }
    
    if (user) {
      isGuest = false;
    }

    const items = [];
    for (const item of cart) {
      const supplement = await Supplement.findById(item._id);

      if (!supplement) {
        return res.status(404).json({
          success: false,
          message: `Supplement not found: ${item.productName}`,
        });
      }
      if (supplement.quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${supplement.productName}`,
        });
      }

      items.push({
        productId: supplement._id,
        productName: supplement.productName,
        quantity: item.quantity,
        price: supplement.salePrice,
        subtotal: supplement.salePrice * item.quantity,
      });
    }

    let discountPayload = {
      amount: 0,
      typeOfDiscount: "percentage",
      value: 0,
      code: undefined,
    };
    let discountAmount = 0;

    if (couponCode) {
      const coupon = await Coupon.findOne({
        code: couponCode.toUpperCase(),
        category: "SUPPLEMENT",
        isActive: true,
      });

      if (!coupon) {
        return res.status(400).json({ success: false, message: "Invalid coupon" });
      }
      if (coupon.expiryDate && new Date() > new Date(coupon.expiryDate)) {
        return res.status(400).json({ success: false, message: "Coupon expired" });
      }
      if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
      }
      if (coupon.minCartAmount && subtotal < coupon.minCartAmount) {
        return res.status(400).json({
          success: false,
          message: `Minimum cart amount of ₹${coupon.minCartAmount} required`,
        });
      }

      if (coupon.typeOfCoupon === "percentage") {
        discountAmount = (subtotal * coupon.value) / 100;
        if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      } else {
        discountAmount = coupon.value;
      }
      discountAmount = Math.min(discountAmount, subtotal);
      
      discountPayload = {
        amount: discountAmount,
        typeOfDiscount: coupon.typeOfCoupon,
        value: coupon.value,
        code: coupon.code,
      };

      await Coupon.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
    }

    for (const item of items) {
      await Supplement.findByIdAndUpdate(item.productId, {
        $inc: { quantity: -item.quantity },
      });
    }

    const totalAmount = Number(subtotal) - Number(discountAmount);
    
    const billData = {
      items,
      discount: discountPayload, 
      subtotal: Number(subtotal),
      discountAmount: Number(discountAmount), 
      total: totalAmount,
      paymentMethod,
      notes: notes || undefined,
      status: "pending",
    };
    
    if (isGuest) {
      billData.guestInfo = {
        fullName: customerInfo.fullName,
        phone: customerInfo.phoneNumber,
        email: customerInfo.email || undefined,
      };
    } else {
      billData.userId = user._id;
    }
    
    const bill = await SupplementBill.create(billData);
    
    if (!bill) {
      return res.status(400).json({ success: false, message: "Failed to create bill" });
    }

    const transactionData = {
      source: "supplement",
      referenceModel: "SupplementBill",
      referenceId: bill._id,
      amount: totalAmount,
      paymentMethod,
      status: "success",
    };
    
    if (isGuest) {
      transactionData.guestInfo = {
        fullName: customerInfo.fullName,
        phone: customerInfo.phoneNumber,
        email: customerInfo.email || undefined,
      };
    } else {
      transactionData.user = user._id;
    }
    
    const trans = await Transaction.create(transactionData);

    if (!trans) {
      return res.status(400).json({ success: false, message: "Failed to create transaction" });
    }

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      bill: {
        _id: bill._id,
        total: totalAmount,
        discountAmount: discountAmount,
        subtotal: subtotal,
        items: items
      },
    });
  } catch (error) {
    console.error("checkoutSupplements error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Server error: " + error.message 
    });
  }
};

const checkUserSupp = asyncHandler(async(req,res) => {
    const phoneNumber = req.params.phoneNumber;
    console.log(phoneNumber)
    const user = await User.findOne({phoneNumber})
    if(!user) throw new ApiError(400,"user wasn't able to found. , out!")

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user,
            "userfound"
        )
    )
})

const fetchAllSuppBill = asyncHandler(async (req, res) => {
  const bills = await SupplementBill.find({}).sort({ createdAt: -1 });

  return res.status(200).json(
    new ApiResponse(200, bills, "All bills fetched successfully")
  );
});

const toggleShipped = asyncHandler(async (req, res) => {
  const bill = await SupplementBill.findById(req.params.billId);

  if (!bill) throw new ApiError(404, "Bill not found!");

  // confirmed → shipped → delivered → confirmed
  const nextStatus = {
    confirmed: "shipped",
    shipped: "delivered",
    delivered: "confirmed",
  };

  bill.status = nextStatus[bill.status] || "confirmed";
  await bill.save();

  return res.status(200).json(
    new ApiResponse(200, bill, `Bill status updated to ${bill.status}`)
  );
});


export { checkoutSupplements,addSupplement, editSupplement, destroySupplement ,checkUserSupp,toggleShipped,fetchAllSuppBill};
export { fetchAllSupp, fetchParticularSupp };