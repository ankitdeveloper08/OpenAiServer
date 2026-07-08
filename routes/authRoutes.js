import express from "express";
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleLogin,
  getMe,
} from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/google", googleLogin);
router.get("/me", authenticate, getMe);

export default router;