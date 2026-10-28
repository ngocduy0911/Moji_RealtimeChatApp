import express from "express";
import {
  refreshToken,
  signIn,
  signOut,
  signUp,
  verifyTwoFactorLogin,
} from "../controllers/authController.js";

const router = express.Router();

router.post("/signup", signUp);

router.post("/signin", signIn);

router.post("/signout", signOut);

router.post("/refresh", refreshToken);

router.post("/2fa/verify-login", verifyTwoFactorLogin);

export default router;
