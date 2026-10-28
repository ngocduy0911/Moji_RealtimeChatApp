// @ts-nocheck
import bcrypt from 'bcryptjs';
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import Session from "../models/Session.js";
import {
  TWO_FACTOR_SELECT,
  checkSecondFactor,
} from "../utils/twoFactor.js";

const ACCESS_TOKEN_TTL = "30m"; // thuờng là dưới 15m
const REFRESH_TOKEN_TTL = 14 * 24 * 60 * 60 * 1000; // 14 ngày
const TWO_FACTOR_TOKEN_TTL = "5m";

// khoá ký riêng: token 2FA tạm thời KHÔNG được dùng như access token
const twoFactorJwtSecret = () => `${process.env.ACCESS_TOKEN_SECRET}:2fa-login`;

export const signUp = async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;

    if (!username || !password || !email || !firstName || !lastName) {
      return res.status(400).json({
        message: "Không thể thiếu username, password, email, firstName, và lastName",
      });
    }

    // kiểm tra username tồn tại chưa
    const duplicate = await User.findOne({ username });

    if (duplicate) {
      return res.status(409).json({ message: "username đã tồn tại" });
    }

    // mã hoá password
    const hashedPassword = await bcrypt.hash(password, 10); // salt = 10

    // tạo user mới
    await User.create({
      username,
      hashedPassword,
      email,
      displayName: `${lastName} ${firstName}`,
    });

    // return
    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi khi gọi signUp", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// tạo access token + refresh token (session) và trả về client
const issueSession = async (res, user) => {
  // nếu khớp, tạo accessToken với JWT
  const accessToken = jwt.sign(
    { userId: user._id },
    // @ts-ignore
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL }
  );

  // tạo refresh token
  const refreshToken = crypto.randomBytes(64).toString("hex");

  // tạo session mới để lưu refresh token
  await Session.create({
    userId: user._id,
    refreshToken,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL),
  });

  // trả refresh token về trong cookie
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none", //backend, frontend deploy riêng
    maxAge: REFRESH_TOKEN_TTL,
  });

  // trả access token về trong res
  return res
    .status(200)
    .json({ message: `User ${user.displayName} đã logged in!`, accessToken });
};

export const signIn = async (req, res) => {
  try {
    // lấy inputs
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Thiếu username hoặc password." });
    }

    // lấy hashedPassword trong db để so với password input
    const user = await User.findOne({ username });

    if (!user) {
      return res
        .status(401)
        .json({ message: "username hoặc password không chính xác" });
    }

    // kiểm tra password
    const passwordCorrect = await bcrypt.compare(password, user.hashedPassword);

    if (!passwordCorrect) {
      return res
        .status(401)
        .json({ message: "username hoặc password không chính xác" });
    }

    // bật 2FA: chưa cấp token, yêu cầu thêm mã xác thực
    if (user.twoFactorEnabled) {
      const twoFactorToken = jwt.sign(
        { userId: user._id, purpose: "2fa-login" },
        twoFactorJwtSecret(),
        { expiresIn: TWO_FACTOR_TOKEN_TTL }
      );

      return res.status(200).json({ twoFactorRequired: true, twoFactorToken });
    }

    return await issueSession(res, user);
  } catch (error) {
    console.error("Lỗi khi gọi signIn", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const signOut = async (req, res) => {
  try {
    // lấy refresh token từ cookie
    const token = req.cookies?.refreshToken;

    if (token) {
      // xoá refresh token trong Session
      await Session.deleteOne({ refreshToken: token });

      // xoá cookie
      res.clearCookie("refreshToken");
    }

    return res.sendStatus(204);
  } catch (error) {
    console.error("Lỗi khi gọi signOut", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// tạo access token mới từ refresh token
export const refreshToken = async (req, res) => {
  try {
    // lấy refresh token từ cookie
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ message: "Token không tồn tại." });
    }

    // so với refresh token trong db
    const session = await Session.findOne({ refreshToken: token });

    if (!session) {
      return res.status(403).json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }

    // kiểm tra hết hạn chưa
    if (session.expiresAt < new Date()) {
      return res.status(403).json({ message: "Token đã hết hạn." });
    }

    // tạo access token mới
    const accessToken = jwt.sign(
      {
        userId: session.userId,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: ACCESS_TOKEN_TTL }
    );

    // return
    return res.status(200).json({ accessToken });
  } catch (error) {
    console.error("Lỗi khi gọi refreshToken", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

// bước 2 của đăng nhập khi đã bật 2FA
export const verifyTwoFactorLogin = async (req, res) => {
  try {
    const { twoFactorToken, code } = req.body;

    if (!twoFactorToken || !code) {
      return res.status(400).json({ message: "Thiếu token hoặc mã xác thực." });
    }

    let payload;
    try {
      payload = jwt.verify(twoFactorToken, twoFactorJwtSecret());
    } catch {
      return res.status(401).json({
        code: "TWO_FACTOR_TOKEN_EXPIRED",
        message: "Phiên xác thực đã hết hạn, hãy đăng nhập lại.",
      });
    }

    if (payload.purpose !== "2fa-login") {
      return res.status(401).json({ message: "Token không hợp lệ." });
    }

    const user = await User.findById(payload.userId).select(TWO_FACTOR_SELECT);

    if (!user || !user.twoFactorEnabled) {
      return res.status(401).json({ message: "Token không hợp lệ." });
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

    return await issueSession(res, user);
  } catch (error) {
    console.error("Lỗi khi gọi verifyTwoFactorLogin", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};
