// @ts-nocheck
import bcrypt from 'bcryptjs';
import User from "../models/User.js";
import {
  TWO_FACTOR_SELECT,
  buildOtpauthUrl,
  checkSecondFactor,
  decryptSecret,
  encryptSecret,
  generateBackupCodes,
  generateSecret,
  verifyTotp,
} from "../utils/twoFactor.js";

// QR được render ở server bằng package `qrcode`.
// Nếu chưa cài, server vẫn chạy và client sẽ hiện secret để nhập tay.
const toQrDataUrl = async (text) => {
  try {
    const { default: QRCode } = await import("qrcode");
    return await QRCode.toDataURL(text, { margin: 1, width: 220 });
  } catch {
    return null;
  }
};

const loadUser = (id) => User.findById(id).select(TWO_FACTOR_SELECT);

// bước 1: tạo secret + QR (chưa bật, chờ xác nhận bằng mã)
export const setupTwoFactor = async (req, res) => {
  try {
    const user = await loadUser(req.user._id);

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: "Xác thực 2 lớp đã được bật." });
    }

    const secret = generateSecret();
    user.twoFactorPendingSecret = encryptSecret(secret);
    await user.save();

    const otpauthUrl = buildOtpauthUrl(secret, user.username);

    return res.status(200).json({
      secret,
      otpauthUrl,
      qrDataUrl: await toQrDataUrl(otpauthUrl),
    });
  } catch (error) {
    console.error("Lỗi khi setupTwoFactor", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// bước 2: nhập mã 6 số đầu tiên để xác nhận -> bật 2FA + trả backup codes (chỉ hiện 1 lần)
export const enableTwoFactor = async (req, res) => {
  try {
    const { code } = req.body;
    const user = await loadUser(req.user._id);

    if (user.twoFactorEnabled) {
      return res.status(400).json({ message: "Xác thực 2 lớp đã được bật." });
    }

    if (!user.twoFactorPendingSecret) {
      return res
        .status(400)
        .json({ message: "Hãy bắt đầu thiết lập trước khi xác nhận." });
    }

    const step = verifyTotp(decryptSecret(user.twoFactorPendingSecret), code);

    if (!step) {
      return res.status(400).json({ message: "Mã xác thực không đúng." });
    }

    const { plain, hashed } = generateBackupCodes();

    user.twoFactorSecret = user.twoFactorPendingSecret;
    user.twoFactorPendingSecret = undefined;
    user.twoFactorEnabled = true;
    user.twoFactorBackupCodes = hashed;
    user.twoFactorLastUsedStep = step;
    user.twoFactorFailedAttempts = 0;
    user.twoFactorLockedUntil = undefined;
    await user.save();

    return res.status(200).json({ backupCodes: plain });
  } catch (error) {
    console.error("Lỗi khi enableTwoFactor", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// tắt 2FA: cần cả mật khẩu và một mã hợp lệ (TOTP hoặc backup code)
export const disableTwoFactor = async (req, res) => {
  try {
    const { password, code } = req.body;

    if (!password || !code) {
      return res.status(400).json({ message: "Cần nhập mật khẩu và mã xác thực." });
    }

    const user = await loadUser(req.user._id);

    if (!user.twoFactorEnabled) {
      return res.status(400).json({ message: "Xác thực 2 lớp chưa được bật." });
    }

    const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordCorrect) {
      return res.status(401).json({ message: "Mật khẩu không chính xác." });
    }

    const result = await checkSecondFactor(user, code);

    if (result.locked) {
      return res.status(429).json({
        message: "Nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.",
      });
    }

    if (!result.ok) {
      return res.status(401).json({ message: "Mã xác thực không đúng." });
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = undefined;
    user.twoFactorPendingSecret = undefined;
    user.twoFactorBackupCodes = [];
    user.twoFactorLastUsedStep = 0;
    await user.save();

    return res.status(200).json({ message: "Đã tắt xác thực 2 lớp." });
  } catch (error) {
    console.error("Lỗi khi disableTwoFactor", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
