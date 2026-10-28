import { uploadImageFromBuffer } from "../middlewares/uploadMiddleware.js";
import User from "../models/User.js";

export const authMe = async (req, res) => {
  try {
    const user = req.user; // lấy từ authMiddleware

    return res.status(200).json({
      user,
    });
  } catch (error) {
    console.error("Lỗi khi gọi authMe", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const searchUserByUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (typeof username !== "string") {
      return res.status(400).json({ message: "Cần cung cấp username trong query." });
    }

    // làm sạch: bỏ khoảng trắng và mọi ký tự '@' người dùng gõ nhầm
    const cleaned = username.replace(/@/g, "").trim();

    if (!cleaned) {
      return res.status(400).json({ message: "Cần cung cấp username trong query." });
    }

    // escape ký tự đặc biệt của regex để tránh ReDoS / regex injection
    const escaped = cleaned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    // khớp toàn bộ username, không phân biệt hoa thường
    const user = await User.findOne({
      username: new RegExp(`^${escaped}$`, "i"),
    }).select("_id displayName username avatarUrl");

    return res.status(200).json({ user });
  } catch (error) {
    console.error("Lỗi xảy ra khi searchUserByUsername", error);
    return res.status(500).json({ message: "Lỗi hệ thống" });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    const file = req.file;
    const userId = req.user._id;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await uploadImageFromBuffer(file.buffer);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        avatarUrl: result.secure_url,
        avatarId: result.public_id,
      },
      {
        new: true,
      }
    ).select("avatarUrl");

    if (!updatedUser.avatarUrl) {
      return res.status(400).json({ message: "Avatar trả về null" });
    }

    return res.status(200).json({ avatarUrl: updatedUser.avatarUrl });
  } catch (error) {
    console.error("Lỗi xảy ra khi upload avatar", error);
    return res.status(500).json({ message: "Upload failed" });
  }
};
