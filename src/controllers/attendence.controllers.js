import { Attendance } from "../models/attendence.models.js";
import { User } from "../models/user.models.js";
import QRCode from "qrcode";
import axios from "axios"
import { Subscription } from "../models/subscription.models.js";
// helper
// const getTodayDate = () => {
//   return new Date().toISOString().split("T")[0]; // YYYY-MM-DD
// };
const getTodayDate = () => {
  const now = new Date();
  const offset = 5.5 * 60; 
  const istTime = new Date(now.getTime() + offset * 60000);
  return istTime.toISOString().split("T")[0];
};


export const markAttendance = async (req, res) => {
  try {
    const { phoneNumber, source = "MANUAL" } = req.body;
    const member = await User.findOne({phoneNumber});
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }
    const p = await Subscription.findOne({user:member._id})

    if (!member.isActive) {
        try {
          await axios.post(process.env.N8N_WEBHOOK_URL, {
            eventType: "subscription_expired",
            memberName: member.username,
            email: member.email,
            phoneNumber: member.phoneNumber,
            plan:p.subscription[p.subscription.length - 1].plan,
            expiredDate:p.subscription[p.subscription.length - 1].endDate.toISOString(),
            expiryNoticeDate: new Date().toISOString()
          });
        } catch (error) {
          console.error(`Failed to send renewal email to ${member.email}:`, error.message);
        }
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

export const getMyQR = async (req, res) => {
  try {
    const memberId = req.user._id.toString();
    const qrDataURL = await QRCode.toDataURL(memberId, {
      width: 300,
      margin: 2,
      color: {
        dark: "#000000",
         light: "#ffffff",
      },
    });

    res.status(200).json({
      qr: qrDataURL,
      memberId,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to generate QR",
      error: error.message,
    });
  }
};

export const markAttendanceByQR = async (req, res) => {
  try {
    const { memberId } = req.body;

    const member = await User.findById(memberId)
      .select("_id username email phoneNumber avatar subscription")
      .populate("subscription");

    if (!member) return res.status(404).json({ message: "Member not found" });

    const subList = member.subscription?.subscription;
    const latestSub = subList?.length ? subList[subList.length - 1] : null;
    const isActive = latestSub?.status === "active";
    const p = await Subscription.findOne({user:member._id})

    if (!isActive) {
        try {
          await axios.post(process.env.N8N_WEBHOOK_URL, {
            eventType: "subscription_expired",
            memberName: member.username,
            email: member.email,
            phoneNumber: member.phoneNumber,
            plan:p.subscription[p.subscription.length - 1].plan,
            expiredDate:p.subscription[p.subscription.length - 1].endDate.toISOString(),
            expiryNoticeDate: new Date().toISOString()
          });
        } catch (error) {
          console.error(`Failed to send renewal email to ${member.email}:`, error.message);
        }
      return res.status(403).json({
        message: "Member is inactive",
        username: member.username,
        avatar: member.avatar?.url || null,
        isActive: false,
      });
    }

    const today = getTodayDate();

    await Attendance.create({
      member: member._id,
      date: today,
      markedBy: member._id,
      source: "QR",
    });

    res.status(201).json({
      message: "Attendance marked successfully",
      username: member.username,
      avatar: member.avatar?.url || null,
      isActive: true,
    });

  } catch (error) {
    if (error.code === 11000) {
      const member = await User.findById(req.body.memberId)
        .select("username avatar subscription")
        .populate("subscription");

      const subList = member?.subscription?.subscription;
      const latestSub = subList?.length ? subList[subList.length - 1] : null;
      const isActive = latestSub?.status === "active";

      return res.status(400).json({
        message: "Already checked in today",
        username: member?.username || null,
        avatar: member?.avatar?.url || null,
        isActive,
        alreadyMarked: true,
      });
    }

    res.status(500).json({ message: "Failed to mark attendance", error: error.message });
  }
};
