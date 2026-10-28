import { create } from "zustand";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import type { AuthState } from "@/types/store";
import { persist } from "zustand/middleware";
import { useChatStore } from "./useChatStore";

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      loading: false,
      twoFactorToken: null,

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },
      setUser: (user) => {
        set({ user });
      },
      clearState: () => {
        set({
          accessToken: null,
          user: null,
          loading: false,
          twoFactorToken: null,
        });
        useChatStore.getState().reset();
        localStorage.clear();
        sessionStorage.clear();
      },
      signUp: async (username, password, email, firstName, lastName) => {
        try {
          set({ loading: true });

          //  gọi api
          await authService.signUp(username, password, email, firstName, lastName);

          toast.success(
            "Đăng ký thành công! Bạn sẽ được chuyển sang trang đăng nhập."
          );
        } catch (error) {
          console.error(error);
          toast.error("Đăng ký không thành công");
        } finally {
          set({ loading: false });
        }
      },
      signIn: async (username, password) => {
        try {
          get().clearState();
          set({ loading: true });

          const data = await authService.signIn(username, password);

          // tài khoản đã bật 2FA: chờ nhập mã ở bước 2
          if (data.twoFactorRequired) {
            set({ twoFactorToken: data.twoFactorToken });
            toast.info("Nhập mã xác thực 2 lớp để tiếp tục");
            return;
          }

          get().setAccessToken(data.accessToken);

          await get().fetchMe();
          useChatStore.getState().fetchConversations();

          toast.success("Chào mừng bạn quay lại với Moji 🎉");
        } catch (error) {
          console.error(error);
          toast.error("Đăng nhập không thành công!");
        } finally {
          set({ loading: false });
        }
      },
      verifyTwoFactor: async (code) => {
        const twoFactorToken = get().twoFactorToken;
        if (!twoFactorToken) return false;

        try {
          set({ loading: true });

          const { accessToken } = await authService.verifyTwoFactor(
            twoFactorToken,
            code
          );

          set({ twoFactorToken: null });
          get().setAccessToken(accessToken);

          await get().fetchMe();
          useChatStore.getState().fetchConversations();

          toast.success("Chào mừng bạn quay lại với Moji 🎉");
          return true;
        } catch (error) {
          console.error(error);
          const data = (
            error as { response?: { data?: { message?: string; code?: string } } }
          ).response?.data;

          toast.error(data?.message ?? "Xác thực không thành công!");

          // token 2FA hết hạn (5 phút) => quay về bước nhập mật khẩu
          if (data?.code === "TWO_FACTOR_TOKEN_EXPIRED") {
            set({ twoFactorToken: null });
          }
          return false;
        } finally {
          set({ loading: false });
        }
      },
      cancelTwoFactor: () => set({ twoFactorToken: null }),
      signOut: async () => {
        try {
          get().clearState();
          await authService.signOut();
          toast.success("Logout thành công!");
        } catch (error) {
          console.error(error);
          toast.error("Lỗi xảy ra khi logout. Hãy thử lại!");
        }
      },
      fetchMe: async () => {
        try {
          set({ loading: true });
          const user = await authService.fetchMe();

          set({ user });
        } catch (error) {
          console.error(error);
          set({ user: null, accessToken: null });
          toast.error("Lỗi xảy ra khi lấy dữ liệu người dùng. Hãy thử lại!");
        } finally {
          set({ loading: false });
        }
      },
      refresh: async () => {
        try {
          set({ loading: true });
          const { user, fetchMe, setAccessToken } = get();
          const accessToken = await authService.refresh();

          setAccessToken(accessToken);

          if (!user) {
            await fetchMe();
          }
        } catch (error) {
          console.error(error);
          toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại!");
          get().clearState();
        } finally {
          set({ loading: false });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ user: state.user }), // chỉ persist user
    }
  )
);
