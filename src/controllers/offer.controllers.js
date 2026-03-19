import { Offer } from "../models/offer.models.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

const addOffer = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    discountType,
    discountValue,
    totalSlots,
    maxDiscount,
    minAmount,
    coupon,
    category,
    startDate,
    expiryDate,
    isActive,
    badgeText,
  } = req.body;

  if (!title || !discountType || !discountValue || !totalSlots || !coupon || !category) {
    return res.status(400).json({
      success: false,
      message: "Missing required fields",
    });
  }

  if (startDate && expiryDate && new Date(startDate) > new Date(expiryDate)) {
    return res.status(400).json({
      success: false,
      message: "Start date cannot be after expiry date",
    });
  }

  const offer = await Offer.create({
    title: title.trim(),
    description,
    discountType,
    discountValue,
    totalSlots,
    maxDiscount,
    minAmount,
    coupon,
    category,
    startDate: startDate ? new Date(startDate) : undefined,
    expiryDate: expiryDate ? new Date(expiryDate) : undefined,
    isActive: isActive ?? true,
    badgeText,
  });

  res.status(201).json({
    success: true,
    message: "Offer created successfully",
    offer,
  });
});

const editOffer = asyncHandler(async (req, res) => {
  const { offerId } = req.params;

  const updateData = { ...req.body };

  if (Object.keys(updateData).length === 0) {
    return res.status(400).json({
      success: false,
      message: "No data provided to update",
    });
  }

  if (
    updateData.startDate &&
    updateData.expiryDate &&
    new Date(updateData.startDate) > new Date(updateData.expiryDate)
  ) {
    return res.status(400).json({
      success: false,
      message: "Start date cannot be after expiry date",
    });
  }
  if (updateData.startDate) {
    updateData.startDate = new Date(updateData.startDate);
  }

  if (updateData.expiryDate) {
    updateData.expiryDate = new Date(updateData.expiryDate);
  }

  if (updateData.title) {
    updateData.title = updateData.title.trim();
  }

  const offer = await Offer.findByIdAndUpdate(
    offerId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: "Offer not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Offer updated successfully",
    offer,
  });
});


const deleteOffer = asyncHandler(async (req, res) => {
  const { offerId } = req.params;

  const offer = await Offer.findByIdAndDelete(offerId);

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: "Offer not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Offer deleted successfully",
  });
});

const toggleOfferActive = asyncHandler(async (req, res) => {
  const { offerId } = req.params;

  const offer = await Offer.findById(offerId);

  if (!offer) {
    return res.status(404).json({
      success: false,
      message: "Offer not found",
    });
  }

  offer.isActive = !offer.isActive;
  await offer.save();

  res.status(200).json({
    success: true,
    message: `Offer ${offer.isActive ? "activated" : "deactivated"} successfully`,
    offer,
  });
});

const fetchOffer = asyncHandler(async(req,res) => {
    const offer = await Offer.find({})
    return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        offer,
        "fetched successfully"
      )
    )
})

export {
    addOffer,
    editOffer,
    deleteOffer,
    toggleOfferActive,
    fetchOffer
}