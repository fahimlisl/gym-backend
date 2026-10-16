
import { getMemberAiSnapshot } from "../service/memberAiSnapshot.service.js";
import axios from "axios"

export const openMemberAi = async (req, res) => {
  try {
    if (req.role !== "user" || req.user?.isActive === false) {
      return res.status(403).json({
        success: false,
        message: "Member access only",
      });
    }

    const memberId = req.user._id.toString();

    const { source, snapshot } =
      await getMemberAiSnapshot(memberId);

    return res.status(200).json({
      success: true,
      message: "Member AI ready",
      source,
      data: snapshot,
    });
  } catch (error) {
    console.error("Member AI error:", error.message);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Unable to initialize Member AI",
    });
  }
};

const ALLOWED_COMPLAINT_CATEGORIES = new Set([
  "trainer",
  "equipment",
  "membership",
  "personal_training",
  "payment",
  "website",
  "staff",
  "other",
]);

const parseComplaintDraft = (candidate) => {
  if (!candidate || candidate.ready !== true) {
    return null;
  }

  const { category, description } = candidate;

  if (
    typeof category !== "string" ||
    !ALLOWED_COMPLAINT_CATEGORIES.has(category)
  ) {
    return null;
  }

  if (typeof description !== "string") {
    return null;
  }

  const cleanDescription = description.trim();

  if (
    cleanDescription.length < 10 ||
    cleanDescription.length > 2000
  ) {
    return null;
  }

  return {
    category,
    description: cleanDescription,
  };
};

export const chatWithMemberAi = async (req, res) => {
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

  const { message, sessionId } = req.body || {};

  if (
    typeof message !== "string" ||
    !message.trim() ||
    message.length > 2000
  ) {
    return res.status(400).json({
      success: false,
      message: "Message must be between 1 and 2000 characters",
    });
  }

  if (
    typeof sessionId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sessionId
    )
  ) {
    return res.status(400).json({
      success: false,
      message: "A valid chat session ID is required",
    });
  }

  const webhookUrl = process.env.N8N_MEMBER_AI_WEBHOOK_URL;
  const webhookSecret = process.env.N8N_MEMBER_AI_SECRET;

  if (!webhookUrl || !webhookSecret) {
    console.error("Member AI n8n configuration missing");

    return res.status(503).json({
      success: false,
      message: "AI Assistant is temporarily unavailable",
    });
  }

  try {
    const memberId = req.user._id.toString();

    // Redis hit -> use snapshot.
    // Redis miss -> MongoDB -> save in Redis.
    const { snapshot } = await getMemberAiSnapshot(memberId);

    const response = await axios.post(
      webhookUrl,
      {
        message: message.trim(),
        sessionId: `member:${memberId}:${sessionId}`,
        memberContext: snapshot,
      },
      {
        headers: {
          "Content-Type": "application/json",
          "X-AlphaGym-Secret": webhookSecret,
        },
        timeout: 60000,
        maxRedirects: 0,
      }
    );

    const output = response.data ?? {};

    if (
      typeof output.reply !== "string" ||
      !output.reply.trim()
    ) {
      return res.status(502).json({
        success: false,
        message: "AI Assistant returned an invalid response",
      });
    }

    res.set("Cache-Control", "no-store");

    return res.status(200).json({
      success: true,
      reply: output.reply.trim(),
      complaintDraft: parseComplaintDraft(
        output.complaintDraft
      ),
    });
  } catch (error) {
    console.error("Member AI request failed:", {
      status: error.response?.status,
      code: error.code,
      message: error.message,
    });

    return res.status(502).json({
      success: false,
      message: "AI Assistant is temporarily unavailable. Please try again.",
    });
  }
};