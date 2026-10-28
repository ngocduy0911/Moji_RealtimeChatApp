import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    hashedPassword: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    avatarUrl: {
      type: String, // link CDN để hiển thị hình
    },
    avatarId: {
      type: String, // Cloudinary public_id để xoá hình
    },
    bio: {
      type: String,
      maxlength: 500, // tuỳ
    },
    phone: {
      type: String,
      sparse: true, // cho phép null, nhưng không được trùng
    },

    // ---- Xác thực 2 lớp (TOTP) ----
    // chỉ cờ này được trả về client; mọi field còn lại là select: false
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    twoFactorSecret: { type: String, select: false }, // đã mã hoá AES-256-GCM
    twoFactorPendingSecret: { type: String, select: false }, // secret đang chờ xác nhận
    twoFactorBackupCodes: { type: [String], select: false, default: [] }, // sha256
    twoFactorFailedAttempts: { type: Number, default: 0, select: false },
    twoFactorLockedUntil: { type: Date, select: false },
    twoFactorLastUsedStep: { type: Number, default: 0, select: false },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);
export default User;
