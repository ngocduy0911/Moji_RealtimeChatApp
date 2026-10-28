import { useAuthStore } from "@/stores/useAuthStore";
import type { Conversation } from "@/types/chat";
import { useEffect, useRef, useState } from "react";
import { Button } from "../ui/button";
import { ImagePlus, Send, X } from "lucide-react";
import { Input } from "../ui/input";
import EmojiPicker from "./EmojiPicker";
import { useChatStore } from "@/stores/useChatStore";
import { useSocketStore } from "@/stores/useSocketStore";
import { chatService } from "@/services/chatService";
import { toast } from "sonner";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB, khớp với giới hạn ở backend
const TYPING_IDLE_MS = 2000; // sau 2s không gõ => gửi "dừng gõ"
const TYPING_HEARTBEAT_MS = 3000; // nhắc lại "đang gõ" để phía nhận không tự hết hạn

const MessageInput = ({ selectedConvo }: { selectedConvo: Conversation }) => {
  const { user } = useAuthStore();
  const { sendDirectMessage, sendGroupMessage } = useChatStore();
  const { socket } = useSocketStore();

  const [value, setValue] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isTypingRef = useRef(false);
  const lastTypingEmitRef = useRef(0);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const emitTyping = (isTyping: boolean) => {
    socket?.emit("typing", { conversationId: selectedConvo._id, isTyping });
    isTypingRef.current = isTyping;
    lastTypingEmitRef.current = Date.now();
  };

  const stopTyping = () => {
    clearTimeout(idleTimerRef.current);
    if (isTypingRef.current) emitTyping(false);
  };

  // đổi cuộc trò chuyện / rời khỏi màn hình => báo dừng gõ
  useEffect(() => {
    return () => {
      clearTimeout(idleTimerRef.current);
      if (isTypingRef.current) {
        socket?.emit("typing", {
          conversationId: selectedConvo._id,
          isTyping: false,
        });
        isTypingRef.current = false;
      }
    };
  }, [selectedConvo._id, socket]);

  // giải phóng URL preview
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  if (!user) return;

  const handleChange = (text: string) => {
    setValue(text);

    if (!text.trim()) {
      stopTyping();
      return;
    }

    if (
      !isTypingRef.current ||
      Date.now() - lastTypingEmitRef.current > TYPING_HEARTBEAT_MS
    ) {
      emitTyping(true);
    }

    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => emitTyping(false), TYPING_IDLE_MS);
  };

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // cho phép chọn lại cùng 1 file

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Chỉ có thể gửi file ảnh");
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("Ảnh quá lớn, tối đa 5MB");
      return;
    }

    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setPreview(null);
  };

  const sendMessage = async () => {
    if ((!value.trim() && !imageFile) || uploading) return;

    const currValue = value.trim();
    let imgUrl: string | undefined;

    if (imageFile) {
      try {
        setUploading(true);
        imgUrl = await chatService.uploadImage(imageFile);
      } catch (error) {
        console.error(error);
        toast.error("Không thể tải ảnh lên. Bạn hãy thử lại!");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    setValue("");
    clearImage();
    stopTyping();

    try {
      if (selectedConvo.type === "direct") {
        const participants = selectedConvo.participants;
        const otherUser = participants.filter((p) => p._id !== user._id)[0];
        await sendDirectMessage(otherUser._id, currValue, imgUrl);
      } else {
        await sendGroupMessage(selectedConvo._id, currValue, imgUrl);
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi xảy ra khi gửi tin nhắn. Bạn hãy thử lại!");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="bg-background">
      {/* preview ảnh trước khi gửi */}
      {preview && (
        <div className="px-3 pt-3">
          <div className="relative inline-block">
            <img
              src={preview}
              alt="Ảnh sắp gửi"
              className="h-20 rounded-lg object-cover border border-border/50"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute -top-2 -right-2 size-5 rounded-full bg-destructive text-white flex items-center justify-center"
              aria-label="Bỏ ảnh"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 p-3 min-h-[56px]">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePickImage}
        />
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10 transition-smooth"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          <ImagePlus className="size-4" />
        </Button>

        <div className="flex-1 relative">
          <Input
            onKeyPress={handleKeyPress}
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={stopTyping}
            placeholder="Soạn tin nhắn..."
            className="pr-20 h-9 bg-white border-border/50 focus:border-primary/50 transition-smooth resize-none"
          ></Input>
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="size-8 hover:bg-primary/10 transition-smooth"
            >
              <div>
                <EmojiPicker
                  onChange={(emoji: string) => handleChange(`${value}${emoji}`)}
                />
              </div>
            </Button>
          </div>
        </div>

        <Button
          onClick={sendMessage}
          className="bg-gradient-chat hover:shadow-glow transition-smooth hover:scale-105"
          disabled={(!value.trim() && !imageFile) || uploading}
        >
          <Send className="size-4 text-white" />
        </Button>
      </div>
    </div>
  );
};

export default MessageInput;
