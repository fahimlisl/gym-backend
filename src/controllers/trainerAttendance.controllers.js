import { TrainerAttendance } from "../models/trainerAttendance.models.js";
import { Trainer } from "../models/trainer.models.js";
import QRCode from "qrcode";

const getTodayDate = () => {
  const now = new Date();
  const offset = 5.5 * 60;
  const istTime = new Date(now.getTime() + offset * 60000);
  return istTime.toISOString().split("T")[0];
};

// GET /trainer/my-qr  (verifyJWT + isTrainer)
export const getTrainerQR = async (req, res) => {
  try {
    const id = req.user._id.toString();

    const payload = `TRAINER::${id}`;

    const qrDataURL = await QRCode.toDataURL(payload, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    res.status(200).json({
      qr: qrDataURL,
      trainerId: id,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to generate QR", error: error.message });
  }
};

// POST /attendance/trainer/qr  (public — same as member QR endpoint pattern)
export const markTrainerAttendanceByQR = async (req, res) => {
  try {
    const { trainerId } = req.body;

    const trainer = await Trainer.findById(trainerId).select(
      "_id fullName email phoneNumber avatar"
    );

    if (!trainer) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    const today = getTodayDate();

    await TrainerAttendance.create({
      trainer: trainer._id,
      date: today,
      source: "QR",
    });

    res.status(201).json({
      message: "Attendance marked successfully",
      fullName: trainer.fullName,
      avatar: trainer.avatar?.url || null,
    });
  } catch (error) {
    if (error.code === 11000) {
      const trainer = await Trainer.findById(req.body.trainerId).select(
        "fullName avatar"
      );

      return res.status(400).json({
        message: "Already checked in today",
        fullName: trainer?.fullName || null,
        avatar: trainer?.avatar?.url || null,
        alreadyMarked: true,
      });
    }

    res.status(500).json({ message: "Failed to mark attendance", error: error.message });
  }
};

// POST /attendance/trainer/checkout
export const checkoutTrainer = async (req, res) => {
  try {
    const { trainerId } = req.body;
    const today = getTodayDate();

    const attendance = await TrainerAttendance.findOne({ trainer: trainerId, date: today });

    if (!attendance) {
      return res.status(404).json({ message: "No check-in found for today" });
    }

    if (attendance.checkOut) {
      return res.status(400).json({ message: "Trainer already checked out" });
    }

    attendance.checkOut = new Date();
    await attendance.save();

    res.json({ message: "Checked out successfully", attendance });
  } catch (error) {
    res.status(500).json({ message: "Checkout failed", error: error.message });
  }
};

// GET /attendance/trainer/today  (admin)
export const getAdminTodayOfTrainerAttendance = async (req, res) => {
  try {
    const today = getTodayDate();

    const attendance = await TrainerAttendance.find({ date: today })
      .populate("trainer", "fullName phoneNumber avatar")
      .sort({ checkIn: -1 });

    res.json({ count: attendance.length, attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch attendance", error: error.message });
  }
};

// GET /attendance/trainer/month?month=2026-03  (admin)
export const getTrainerMonthlyAttendance = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ message: "Month is required (YYYY-MM)" });
    }

    const attendance = await TrainerAttendance.find({
      date: { $regex: `^${month}` },
    })
      .populate("trainer", "fullName phoneNumber avatar")
      .sort({ date: 1, checkIn: 1 });

    res.json({ month, count: attendance.length, attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch monthly attendance", error: error.message });
  }
};

// GET /attendance/trainer/:trainerId/month?month=2026-03  (admin or self)
export const getSingleTrainerMonthlyAttendance = async (req, res) => {
  try {
    const { trainerId } = req.params;
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ message: "Month is required (YYYY-MM)" });
    }

    const attendance = await TrainerAttendance.find({
      trainer: trainerId,
      date: { $regex: `^${month}` },
    }).sort({ date: 1 });

    res.json({ trainerId, month, count: attendance.length, attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch trainer attendance", error: error.message });
  }
};

// GET /attendance/trainer/my?month=2026-03  (verifyJWT + isTrainer — self)
export const getMyAttendance = async (req, res) => {
  try {
    const { month } = req.query;
    const trainerId = req.user._id;

    if (!month) {
      return res.status(400).json({ message: "Month is required (YYYY-MM)" });
    }

    const attendance = await TrainerAttendance.find({
      trainer: trainerId,
      date: { $regex: `^${month}` },
    }).sort({ date: 1 });

    res.json({ trainerId, month, count: attendance.length, attendance });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch your attendance", error: error.message });
  }
};


export const markTrainerAttendanceByGymQR = async (req, res) => {
  try {
    const trainer = await Trainer.findById(req.user._id).select(
      "_id fullName email phoneNumber avatar"
    );
    if (!trainer) return res.status(404).json({ message: "Trainer not found" });

    const today = getTodayDate();
    const existing = await TrainerAttendance.findOne({ trainer: trainer._id, date: today });

    if (existing?.checkOut) {
      return res.status(400).json({
        message: "Already checked out for today",
        fullName: trainer.fullName,
        avatar: trainer.avatar?.url || null,
        alreadyCheckedOut: true,
      });
    }

    if (existing && !existing.checkOut) {
      existing.checkOut = new Date();
      await existing.save();
      return res.status(200).json({
        message: "Checked out successfully",
        fullName: trainer.fullName,
        avatar: trainer.avatar?.url || null,
        isCheckout: true,
      });
    }

    await TrainerAttendance.create({
      trainer: trainer._id,
      date: today,
      source: "QR",
    });

    res.status(201).json({
      message: "Attendance marked successfully",
      fullName: trainer.fullName,
      avatar: trainer.avatar?.url || null,
      isCheckout: false,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark attendance", error: error.message });
  }
};