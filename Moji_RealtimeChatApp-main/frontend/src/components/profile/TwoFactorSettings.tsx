import { useState } from "react";
import { Copy, Download, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthStore } from "@/stores/useAuthStore";
import {
  getApiErrorMessage,
  twoFactorService,
  type TwoFactorSetupData,
} from "@/services/twoFactorService";

type Step = "closed" | "scan" | "backup" | "disable";

const TwoFactorSettings = () => {
  const { user, fetchMe } = useAuthStore();
  const enabled = !!user?.twoFactorEnabled;

  const [step, setStep] = useState<Step>("closed");
  const [busy, setBusy] = useState(false);
  const [setupData, setSetupData] = useState<TwoFactorSetupData | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const close = () => {
    setStep("closed");
    setSetupData(null);
    setCode("");
    setPassword("");
    setBackupCodes([]);
  };

  const startSetup = async () => {
    try {
      setBusy(true);
      setSetupData(await twoFactorService.setup());
      setStep("scan");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể bắt đầu thiết lập 2FA"));
    } finally {
      setBusy(false);
    }
  };

  const confirmEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      const codes = await twoFactorService.enable(code.trim());
      setBackupCodes(codes);
      setCode("");
      setStep("backup");
      await fetchMe(); // cập nhật user.twoFactorEnabled
      toast.success("Đã bật xác thực 2 lớp");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Mã xác thực không đúng"));
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      await twoFactorService.disable(password, code.trim());
      await fetchMe();
      toast.success("Đã tắt xác thực 2 lớp");
      close();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không thể tắt xác thực 2 lớp"));
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = async () => {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Đã sao chép mã dự phòng");
  };

  const downloadCodes = () => {
    const blob = new Blob(
      [
        `Moji - Mã dự phòng 2FA (mỗi mã chỉ dùng được 1 lần)\n\n${backupCodes.join("\n")}\n`,
      ],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "moji-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border/30 p-3 glass-light">
        <div className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="size-4 text-green-600" />
          ) : (
            <ShieldOff className="size-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium flex items-center gap-2">
              Xác thực 2 lớp (2FA)
              <Badge variant={enabled ? "default" : "outline"}>
                {enabled ? "Đang bật" : "Đang tắt"}
              </Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              Thêm mã từ ứng dụng xác thực mỗi lần đăng nhập.
            </p>
          </div>
        </div>

        {enabled ? (
          <Button
            variant="outline"
            size="sm"
            className="hover:text-destructive"
            onClick={() => setStep("disable")}
          >
            Tắt
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={startSetup}
            disabled={busy}
          >
            Bật
          </Button>
        )}
      </div>

      {/* Bước 1: quét QR + nhập mã xác nhận */}
      <Dialog
        open={step === "scan"}
        onOpenChange={(o) => !o && close()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bật xác thực 2 lớp</DialogTitle>
            <DialogDescription>
              Quét mã QR bằng Google Authenticator, Authy hoặc ứng dụng tương
              tự, rồi nhập mã 6 số hiển thị.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={confirmEnable}
            className="space-y-4"
          >
            <div className="flex flex-col items-center gap-3">
              {setupData?.qrDataUrl && (
                <img
                  src={setupData.qrDataUrl}
                  alt="QR code 2FA"
                  className="size-44 rounded-md bg-white p-1"
                />
              )}
              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  {setupData?.qrDataUrl
                    ? "Không quét được? Nhập khoá này thủ công:"
                    : "Nhập khoá này vào ứng dụng xác thực:"}
                </p>
                <code className="text-sm font-mono break-all select-all">
                  {setupData?.secret}
                </code>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="enable-code">Mã 6 số</Label>
              <Input
                id="enable-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="text-center text-lg tracking-widest"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
              >
                Huỷ
              </Button>
              <Button
                type="submit"
                disabled={busy || code.replace(/\s/g, "").length !== 6}
              >
                Xác nhận & bật
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bước 2: lưu mã dự phòng (chỉ hiện 1 lần) */}
      <Dialog
        open={step === "backup"}
        onOpenChange={(o) => !o && close()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Lưu mã dự phòng</DialogTitle>
            <DialogDescription>
              Nếu mất điện thoại, bạn có thể đăng nhập bằng một trong các mã
              này. Mỗi mã chỉ dùng được một lần và sẽ không hiển thị lại.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 font-mono text-sm">
            {backupCodes.map((c) => (
              <span
                key={c}
                className="select-all"
              >
                {c}
              </span>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={copyCodes}
            >
              <Copy className="size-4 mr-2" />
              Sao chép
            </Button>
            <Button
              variant="outline"
              onClick={downloadCodes}
            >
              <Download className="size-4 mr-2" />
              Tải về
            </Button>
            <Button onClick={close}>Tôi đã lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tắt 2FA */}
      <Dialog
        open={step === "disable"}
        onOpenChange={(o) => !o && close()}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tắt xác thực 2 lớp</DialogTitle>
            <DialogDescription>
              Nhập mật khẩu và một mã xác thực (hoặc mã dự phòng) để xác nhận.
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={confirmDisable}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="disable-password">Mật khẩu</Label>
              <Input
                id="disable-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="disable-code">Mã xác thực</Label>
              <Input
                id="disable-code"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={12}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
              >
                Huỷ
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={busy || !password || !code.trim()}
              >
                Tắt 2FA
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default TwoFactorSettings;
