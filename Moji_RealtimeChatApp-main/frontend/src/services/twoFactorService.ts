import api from "@/lib/axios";

export interface TwoFactorSetupData {
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string | null; // null nếu server chưa cài package `qrcode`
}

export const twoFactorService = {
  async setup(): Promise<TwoFactorSetupData> {
    const res = await api.post("/2fa/setup");
    return res.data;
  },

  async enable(code: string): Promise<string[]> {
    const res = await api.post("/2fa/enable", { code });
    return res.data.backupCodes;
  },

  async disable(password: string, code: string) {
    const res = await api.post("/2fa/disable", { password, code });
    return res.data;
  },
};

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  const e = error as { response?: { data?: { message?: string } } };
  return e?.response?.data?.message ?? fallback;
};
