import { useState } from "react";
import { useNavigate } from "react-router";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/stores/useAuthStore";

const TwoFactorLoginForm = () => {
  const { verifyTwoFactor, cancelTwoFactor, loading } = useAuthStore();
  const navigate = useNavigate();
  const [code, setCode] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    const ok = await verifyTwoFactor(code.trim());
    if (ok) navigate("/");
    else setCode("");
  };

  return (
    <form
      className="p-6 md:p-8"
      onSubmit={onSubmit}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col items-center text-center gap-2">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Xác thực 2 lớp</h1>
          <p className="text-muted-foreground text-balance">
            Nhập mã 6 số trong ứng dụng xác thực (Google Authenticator, Authy...)
            của bạn.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Label
            htmlFor="code"
            className="block text-sm"
          >
            Mã xác thực
          </Label>
          <Input
            id="code"
            autoFocus
            autoComplete="one-time-code"
            inputMode="text"
            placeholder="123456"
            maxLength={12}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="text-center text-lg tracking-widest"
          />
          <p className="text-xs text-muted-foreground">
            Mất điện thoại? Nhập một mã dự phòng (dạng <code>xxxxx-xxxxx</code>)
            vào ô trên.
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !code.trim()}
        >
          Xác nhận
        </Button>

        <button
          type="button"
          onClick={cancelTwoFactor}
          className="text-center text-sm underline underline-offset-4"
        >
          Quay lại đăng nhập
        </button>
      </div>
    </form>
  );
};

export default TwoFactorLoginForm;
