import mongoose, { Schema } from "mongoose";
import { randomUUID } from "node:crypto";

const memberComplaintSchema = new Schema(
  {
    complaintId: {
      type: String,
      unique: true,
      required: true,
      default: () => `AGC-${randomUUID()}`,
    },

    member: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    category: {
      type: String,
      enum: [
        "trainer",
        "equipment",
        "membership",
        "personal_training",
        "payment",
        "website",
        "staff",
        "other",
      ],
      default: "other",
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 10,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: ["open", "in_progress", "resolved", "rejected"],
      default: "open",
    },

    source: {
      type: String,
      enum: ["MEMBER_AI"],
      default: "MEMBER_AI",
      immutable: true,
    },

    confirmedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

memberComplaintSchema.index({
  member: 1,
  createdAt: -1,
});

export const MemberComplaint = mongoose.model(
  "MemberComplaint",
  memberComplaintSchema
);