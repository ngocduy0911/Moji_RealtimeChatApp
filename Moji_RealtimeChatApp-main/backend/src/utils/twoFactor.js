import crypto from "crypto";

/* ------------------------------------------------------------------ */
/* TOTP (RFC 6238) - HMAC-SHA1, 6 chữ số, chu kỳ 30s                   */
/* Tương thích Google Authenticator, Authy, Microsoft Authenticator... */
/* ------------------------------------------------------------------ */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PERIOD_MS = 30 * 1000;
const DIGITS = 6;

export const base32Encode = (buf) => {
  let bits = 0;
  let value = 0;
  let out = "";

  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
};

export const base32Decode = (str) => {
  const clean = str.replace(/=+$/, "").replace(/\s+/g, "").toUpperCase();
  let bits = 0;
  let value = 0;
  const out = [];

  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx === -1) throw new Error("Base32 không hợp lệ");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(out);
};

export const generateSecret = () => base32Encode(crypto.randomBytes(20)); // 160-bit

const hotp = (secretBuf, counter, digits = DIGITS) => {
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", secretBuf).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binary % 10 ** digits).padStart(digits, "0");
};

export const generateTotp = (secret, now = Date.now(), digits = DIGITS) =>
  hotp(base32Decode(secret), Math.floor(now / PERIOD_MS), digits);

const safeEqual = (a, b) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

/**
 * Kiểm tra mã TOTP, cho phép lệch ±window chu kỳ (đồng hồ điện thoại hơi lệch).
 * Trả về "time step" đã khớp (để chống dùng lại), hoặc null nếu sai.
 * lastUsedStep: step gần nhất đã được dùng -> mã cũ hơn/bằng sẽ bị từ chối (chống replay).
 */
export const verifyTotp = (
  secret,
  code,
  { now = Date.now(), window = 1, lastUsedStep = 0 } = {}
) => {
  const normalized = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(normalized)) return null;

  const secretBuf = base32Decode(secret);
  const currentStep = Math.floor(now / PERIOD_MS);
  let matched = null;

  for (let i = -window; i <= window; i++) {
    const step = currentStep + i;
    if (step <= lastUsedStep) continue;
    if (safeEqual(hotp(secretBuf, step), normalized)) matched = step;
  }

  return matched;
};

export const buildOtpauthUrl = (secret, accountName, issuer = "Moji") => {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  return (
    `otpauth://totp/${label}?secret=${secret}` +
    `&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=30`
  );
};

/* ------------------------------------------------------------------ */
/* Mã hoá secret khi lưu DB (AES-256-GCM)                              */
/* ------------------------------------------------------------------ */

const encryptionKey = () =>
  crypto
    .createHash("sha256")
    .update(
      process.env.TWO_FACTOR_ENCRYPTION_KEY || process.env.ACCESS_TOKEN_SECRET
    )
    .digest();

export const encryptSecret = (plain) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64")).join(":");
};

export const decryptSecret = (payload) => {
  const [iv, tag, enc] = payload.split(":").map((p) => Buffer.from(p, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
};

/* ------------------------------------------------------------------ */
/* Mã dự phòng (backup codes)                                          */
/* ------------------------------------------------------------------ */

const BACKUP_CODE_COUNT = 8;

const normalizeBackupCode = (code) =>
  String(code ?? "").toLowerCase().replace(/[^a-f0-9]/g, "");

const hashBackupCode = (code) =>
  crypto.createHash("sha256").update(normalizeBackupCode(code)).digest("hex");

export const generateBackupCodes = () => {
  const plain = Array.from({ length: BACKUP_CODE_COUNT }, () => {
    const hex = crypto.randomBytes(5).toString("hex"); // 40-bit
    return `${hex.slice(0, 5)}-${hex.slice(5)}`;
  });

  return { plain, hashed: plain.map(hashBackupCode) };
};

/* ------------------------------------------------------------------ */
/* Xác thực lớp thứ 2 (TOTP hoặc backup code) + khoá chống dò mã       */
/* ------------------------------------------------------------------ */

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;

// các field nhạy cảm đều `select: false` trong model, phải chọn tường minh
export const TWO_FACTOR_SELECT =
  "+hashedPassword +twoFactorSecret +twoFactorPendingSecret +twoFactorBackupCodes +twoFactorFailedAttempts +twoFactorLockedUntil +twoFactorLastUsedStep";

/**
 * @param user mongoose doc đã select TWO_FACTOR_SELECT
 * @returns {{ ok: boolean, locked?: boolean, usedBackupCode?: boolean }}
 */
export const checkSecondFactor = async (user, code) => {
  if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > new Date()) {
    return { ok: false, locked: true };
  }

  let ok = false;
  let usedBackupCode = false;

  const step = verifyTotp(decryptSecret(user.twoFactorSecret), code, {
    lastUsedStep: user.twoFactorLastUsedStep || 0,
  });

  if (step) {
    user.twoFactorLastUsedStep = step;
    ok = true;
  } else {
    const idx = user.twoFactorBackupCodes.indexOf(hashBackupCode(code));
    if (idx !== -1) {
      user.twoFactorBackupCodes.splice(idx, 1); // mỗi mã chỉ dùng 1 lần
      ok = true;
      usedBackupCode = true;
    }
  }

  if (ok) {
    user.twoFactorFailedAttempts = 0;
    user.twoFactorLockedUntil = undefined;
  } else {
    user.twoFactorFailedAttempts = (user.twoFactorFailedAttempts || 0) + 1;
    if (user.twoFactorFailedAttempts >= MAX_FAILED_ATTEMPTS) {
      user.twoFactorLockedUntil = new Date(Date.now() + LOCK_MS);
      user.twoFactorFailedAttempts = 0;
    }
  }

  await user.save();
  return { ok, usedBackupCode };
};
