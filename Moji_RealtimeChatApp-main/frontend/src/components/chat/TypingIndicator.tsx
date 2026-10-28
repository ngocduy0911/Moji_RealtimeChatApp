import { useSocketStore } from "@/stores/useSocketStore";
import { useAuthStore } from "@/stores/useAuthStore";

const TypingIndicator = ({ conversationId }: { conversationId: string }) => {
  const { typingUsers } = useSocketStore();
  const { user } = useAuthStore();

  const names = Object.entries(typingUsers[conversationId] ?? {})
    .filter(([userId]) => userId !== user?._id)
    .map(([, name]) => name)
    .filter(Boolean);

  let text = "";
  if (names.length === 1) text = `${names[0]} đang gõ`;
  else if (names.length === 2) text = `${names[0]} và ${names[1]} đang gõ`;
  else if (names.length > 2) text = "Nhiều người đang gõ";

  // luôn giữ chiều cao cố định để khung chat không bị giật
  return (
    <div className="h-6 px-4 flex items-center gap-1 text-xs text-muted-foreground bg-background">
      {text && (
        <>
          <span>{text}</span>
          <span className="flex gap-0.5 items-center">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1 rounded-full bg-muted-foreground animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </span>
        </>
      )}
    </div>
  );
};

export default TypingIndicator;
