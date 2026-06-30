import express from "express";
import { getPromptStatus } from "../controllers/promptStatusController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();
router.get(
  "/prompt-status",
  authenticate,
  getPromptStatus
);
export default router;