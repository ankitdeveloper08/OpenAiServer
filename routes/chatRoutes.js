import express from "express";
import {
  createChat,
  getChats,
  getChatById,
  duplicateChat,
  renameChat,
} from "../controllers/chatController.js";

import {
  deleteChat,
} from "../controllers/deleteChat.js";

import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticate, createChat);

router.get("/", authenticate, getChats);

router.get("/:id", authenticate, getChatById);
router.delete("/:id", authenticate, deleteChat);
router.post("/:id/duplicate", authenticate, duplicateChat);
router.put("/:id/rename", authenticate, renameChat);

export default router;
