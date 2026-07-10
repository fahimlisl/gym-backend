import { Router } from "express";
import { getWhatsAppStatus } from "../service/sendWp.js";

const router = Router();

router.get("/status", (req, res) => {
  const status = getWhatsAppStatus();
  console.log("status is: ",status)
  res.json(status);
});

export default router;
