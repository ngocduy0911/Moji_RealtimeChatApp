import express from "express";
import {
  disableTwoFactor,
  enableTwoFactor,
  setupTwoFactor,
} from "../controllers/twoFactorController.js";

const router = express.Router();

router.post("/setup", setupTwoFactor);
router.post("/enable", enableTwoFactor);
router.post("/disable", disableTwoFactor);

export default router;
