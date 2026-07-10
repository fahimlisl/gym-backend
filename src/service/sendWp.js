import { asyncHandler } from "../utils/AsyncHandler.js";
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import path from "path";
import pino from "pino";
import fs from "fs-extra";
import { User } from "../models/user.models.js";

let sock = null;
let currentQr = null;
let isConnected = false;
const authDir = path.resolve("auth_info_baileys");

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(authDir);

  sock = makeWASocket({
    auth: state,
    syncFullHistory: false,
    shouldSyncHistoryMessage: () => false,
    markOnlineOnConnect: false,
    logger: pino({ level: "error" }),
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQr = qr;
      isConnected = false;
    }

    if (connection === "open") {
      currentQr = null;
      isConnected = true;
      console.log("✅ WhatsApp connected (send-only)");
    }

    if (connection === "close") {
      isConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.log("Session logged out. Clearing auth folder...");
        fs.removeSync(authDir);
        console.log("Restarting connection...");
        connectToWhatsApp();
      } else {
        console.log("Reconnecting...");
        connectToWhatsApp();
      }
    }
  });

  return sock;
}

connectToWhatsApp();
const sendWpMessage = asyncHandler(async (req, res) => {
  const { phone, message, userId } = req.body;   // now also accept userId

  if (!phone || !message) {
    return res.status(400).json({ success: false, error: "Phone and message are required" });
  }

  if (!sock || sock.user === undefined) {
    return res.status(503).json({ success: false, error: "WhatsApp not connected yet. Scan QR." });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (userId) {
    const user = await User.findById(userId).select("reminderSentAt");
    if (user && user.reminderSentAt && new Date(user.reminderSentAt) >= todayStart) {
      return res.status(429).json({
        success: false,
        error: "A WhatsApp message has already been sent to this user today. Try again tomorrow.",
      });
    }
  }

  try {
    let digits = String(phone).replace(/\D/g, "");
    if (!digits.startsWith("91")) digits = "91" + digits;
    const jid = digits + "@s.whatsapp.net";

    const [result] = await sock.onWhatsApp(jid);
    if (!result || !result.exists) {
      return res.status(400).json({ success: false, error: "Number not on WhatsApp" });
    }

    await sock.sendMessage(jid, { text: message });
    if (userId) {
      await User.findByIdAndUpdate(userId, { reminderSentAt: new Date() });
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error("WhatsApp send error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export const getWhatsAppStatus = () => ({
  connected: isConnected && sock?.user !== undefined,
  qr: currentQr,
});


export const sendWhatsAppMessage = async (phone, message) => {
  if (!sock || sock.user === undefined) {
    throw new Error("WhatsApp not connected yet. Scan QR.");
  }

  let digits = String(phone).replace(/\D/g, "");
  if (!digits.startsWith("91")) {
    digits = "91" + digits;
  }
  const jid = digits + "@s.whatsapp.net";

  const [result] = await sock.onWhatsApp(jid);
  if (!result || !result.exists) {
    throw new Error("Number not on WhatsApp");
  }

  await sock.sendMessage(jid, { text: message });
};


export { sendWpMessage };