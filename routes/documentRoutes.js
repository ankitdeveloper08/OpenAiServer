import express from "express";
import { generateDocument } from "../controllers/documentController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/", authenticate, generateDocument);

export default router;
