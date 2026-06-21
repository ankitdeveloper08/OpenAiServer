import express from "express";
import { addMessage } from "../controllers/messageController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

// Add message to chat
router.post("/", authenticate, addMessage);

export default router;