import { MemberComplaint } from "../models/memberComplaint.models.js";

const ALLOWED_CATEGORIES = new Set([
  "trainer",
  "equipment",
  "membership",
  "personal_training",
  "payment",
  "website",
  "staff",
  "other",
]);

export const createMemberComplaint = async (req, res) => {
  if (
    req.role !== "user" ||
    !req.user?._id ||
    req.user.isActive === false
  ) {
    return res.status(403).json({
      success: false,
      message: "Member access only",
    });
  }

  const { category = "other", description } = req.body ?? {};

  if (
    typeof category !== "string" ||
    !ALLOWED_CATEGORIES.has(category)
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid complaint category",
    });
  }

  if (
    typeof description !== "string" ||
    description.trim().length < 10 ||
    description.trim().length > 2000
  ) {
    return res.status(400).json({
      success: false,
      message: "Complaint description must be between 10 and 2000 characters",
    });
  }

  try {
    const complaint = await MemberComplaint.create({
      member: req.user._id,
      category,
      description: description.trim(),
      confirmedAt: new Date(),
    });

    res.set("Cache-Control", "no-store");

    return res.status(201).json({
      success: true,
      message: "Complaint submitted successfully",
      data: {
        complaintId: complaint.complaintId,
        category: complaint.category,
        description: complaint.description,
        status: complaint.status,
        createdAt: complaint.createdAt,
      },
    });
  } catch (error) {
    console.error("Complaint creation failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to submit complaint. Please try again later.",
    });
  }
};




// admin 

import mongoose from "mongoose";
import { User } from "../models/user.models.js";

const VALID_STATUSES = new Set([
  "open",
  "in_progress",
  "resolved",
  "rejected",
]);

const VALID_CATEGORIES = new Set([
  "trainer",
  "equipment",
  "membership",
  "personal_training",
  "payment",
  "website",
  "staff",
  "other",
]);

function requireAdmin(req, res) {
  if (req.role !== "admin" || !req.user?._id) {
    res.status(403).json({
      success: false,
      message: "Admin access required",
    });
    return false;
  }
  return true;
}

function escapeRegex(input) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatComplaint(doc) {
  const complaint = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const member = complaint.member;
  return {
    id: String(complaint._id),
    complaintId: complaint.complaintId,
    category: complaint.category,
    description: complaint.description,
    status: complaint.status,
    source: complaint.source,
    confirmedAt: complaint.confirmedAt,
    resolvedAt: complaint.resolvedAt,
    createdAt: complaint.createdAt,
    updatedAt: complaint.updatedAt,
    member: member && typeof member === "object" && member.username !== undefined
      ? {
          id: String(member._id),
          username: member.username ?? "Unknown member",
          phoneNumber: member.phoneNumber == null ? "" : String(member.phoneNumber),
          email: member.email ?? "",
        }
      : null,
  };
}

// GET /api/v1/admin/member-complaints?page=1&limit=15&status=all&category=all&search=
export const getAdminMemberComplaints = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const page = Math.max(1, Math.min(100000, Number.parseInt(req.query.page, 10) || 1));
    const limit = Math.max(1, Math.min(50, Number.parseInt(req.query.limit, 10) || 15));
    const status = typeof req.query.status === "string" ? req.query.status : "all";
    const category = typeof req.query.category === "string" ? req.query.category : "all";
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    if (status !== "all" && !VALID_STATUSES.has(status)) {
      return res.status(400).json({ success: false, message: "Invalid status filter" });
    }
    if (category !== "all" && !VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ success: false, message: "Invalid category filter" });
    }
    if (search.length > 100) {
      return res.status(400).json({ success: false, message: "Search must be 100 characters or fewer" });
    }

    const filter = {};
    if (status !== "all") filter.status = status;
    if (category !== "all") filter.category = category;

    if (search) {
      const safeSearch = new RegExp(escapeRegex(search), "i");
      const memberMatch = [{ username: safeSearch }, { email: safeSearch }];
      // Phone is stored as Number in your User model. Match a complete number.
      if (/^\d{7,15}$/.test(search)) memberMatch.push({ phoneNumber: Number(search) });
      const memberIds = await User.distinct("_id", { $or: memberMatch });
      filter.$or = [
        { complaintId: safeSearch },
        { description: safeSearch },
        { member: { $in: memberIds } },
      ];
    }

    const [complaints, total] = await Promise.all([
      MemberComplaint.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("member", "username phoneNumber email")
        .lean(),
      MemberComplaint.countDocuments(filter),
    ]);

    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      data: {
        complaints: complaints.map(formatComplaint),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    });
  } catch (error) {
    console.error("Admin complaints fetch error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load complaints" });
  }
};

// GET /api/v1/admin/member-complaints/stats
export const getAdminMemberComplaintStats = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  try {
    const counts = await MemberComplaint.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const stats = { total: 0, open: 0, in_progress: 0, resolved: 0, rejected: 0 };
    for (const item of counts) {
      if (VALID_STATUSES.has(item._id)) {
        stats[item._id] = item.count;
        stats.total += item.count;
      }
    }

    res.set("Cache-Control", "no-store");
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error("Admin complaint stats error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to load complaint statistics" });
  }
};

export const updateAdminMemberComplaintStatus = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const { id } = req.params;
  const { status } = req.body ?? {};

  if (!mongoose.isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: "Invalid complaint ID" });
  }
  if (typeof status !== "string" || !VALID_STATUSES.has(status)) {
    return res.status(400).json({ success: false, message: "Invalid complaint status" });
  }

  try {
    const complaint = await MemberComplaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    if (complaint.status !== status) {
      complaint.status = status;
      complaint.resolvedAt = status === "resolved" ? new Date() : null;
      await complaint.save();
    }

    await complaint.populate("member", "username phoneNumber email");
    res.set("Cache-Control", "no-store");
    return res.status(200).json({
      success: true,
      message: "Complaint status updated successfully",
      data: formatComplaint(complaint),
    });
  } catch (error) {
    console.error("Admin complaint status update error:", error.message);
    return res.status(500).json({ success: false, message: "Could not update complaint status" });
  }
};
