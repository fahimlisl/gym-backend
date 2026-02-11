import { Attendance } from "../models/attendence.models.js";
import { User } from "../models/user.models.js";

// helper
const getTodayDate = () => {
  return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
};

export const markAttendance = async (req, res) => {
  try {
    const { phoneNumber, source = "MANUAL" } = req.body;
    const member = await User.findOne({phoneNumber});
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (!member.isActive) {
      return res.status(403).json({ message: "Member is inactive" });
    }

    const today = getTodayDate();

    const attendance = await Attendance.create({
      member: member._id,
      date: today,
      markedBy: req.user?._id || null, // admin/trainer or null (QR/biometric)
      source,
    });

    res.status(201).json({
      message: "Attendance marked successfully",
      attendance,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Attendance already marked for today",
      });
    }

    res.status(500).json({
      message: "Failed to mark attendance",
      error: error.message,
    });
  }
};


export const checkoutMember = async (req, res) => {
  try {
    const { memberId } = req.body;
    const today = getTodayDate();

    const attendance = await Attendance.findOne({
      member: memberId,
      date: today,
    });

    if (!attendance) {
      return res.status(404).json({
        message: "No check-in found for today",
      });
    }

    if (attendance.checkOut) {
      return res.status(400).json({
        message: "Member already checked out",
      });
    }

    attendance.checkOut = new Date();
    await attendance.save();

    res.json({
      message: "Checked out successfully",
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Checkout failed",
      error: error.message,
    });
  }
};


export const getTodayAttendance = async (req, res) => {
  try {
    const today = getTodayDate();

    const attendance = await Attendance.find({ date: today })
      .populate("member", "username phoneNumber avatar")
      .sort({ checkIn: -1 });

    res.json({
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch attendance",
      error: error.message,
    });
  }
};


// /attendance/month?month=2026-02
export const getMonthlyAttendance = async (req, res) => {
  try {
    const { month } = req.query; // YYYY-MM

    if (!month) {
      return res.status(400).json({
        message: "Month is required (YYYY-MM)",
      });
    }

    const attendance = await Attendance.find({
      date: { $regex: `^${month}` },
    })
      .populate("member", "username phoneNumber avatar")
      .sort({ date: 1, checkIn: 1 });

    res.json({
      month,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch monthly attendance",
      error: error.message,
    });
  }
};


export const getMemberMonthlyAttendance = async (req, res) => {
  try {
    const { memberId } = req.params;
    const { month } = req.query; // YYYY-MM

    if (!month) {
      return res.status(400).json({
        message: "Month is required (YYYY-MM)",
      });
    }

    const filter = {
      member: memberId,
      date: { $regex: `^${month}` },
    };

    const attendance = await Attendance.find(filter)
      .sort({ date: 1 });

    res.json({
      memberId,
      month,
      count: attendance.length,
      attendance,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch member attendance",
      error: error.message,
    });
  }
};

