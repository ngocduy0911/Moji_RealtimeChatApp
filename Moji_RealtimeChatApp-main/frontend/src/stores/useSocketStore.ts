import { create } from "zustand";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "./useAuthStore";
import type { SocketState } from "@/types/store";
import { useChatStore } from "./useChatStore";
import { useFriendStore } from "./useFriendStore";
import { toast } from "sonner";
import type { FriendRequest, Friend } from "@/types/user";

const TYPING_EXPIRE_MS = 6000;
const typingTimers: Record<string, ReturnType<typeof setTimeout>> = {};

const baseURL = import.meta.env.VITE_SOCKET_URL;

export const useSocketStore = create<SocketState>((set, get) => ({
  socket: null,
  onlineUsers: [],
  typingUsers: {},
  connectSocket: () => {
    const accessToken = useAuthStore.getState().accessToken;
    const existingSocket = get().socket;

    if (existingSocket) return; // tránh tạo nhiều socket

    const socket: Socket = io(baseURL, {
      auth: { token: accessToken },
      transports: ["websocket"],
    });

    set({ socket });

    socket.on("connect", () => {
      console.log("Đã kết nối với socket");
    });

    // online users
    socket.on("online-users", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // typing indicator
    const setTyping = (
      conversationId: string,
      userId: string,
      displayName: string,
      isTyping: boolean
    ) => {
      const timerKey = `${conversationId}:${userId}`;
      clearTimeout(typingTimers[timerKey]);
      delete typingTimers[timerKey];

      set((state) => {
        const convoTyping = { ...(state.typingUsers[conversationId] ?? {}) };

        if (isTyping) {
          convoTyping[userId] = displayName;
        } else {
          delete convoTyping[userId];
        }

        return {
          typingUsers: { ...state.typingUsers, [conversationId]: convoTyping },
        };
      });

      // tự tắt nếu không nhận được tín hiệu dừng (mất mạng, đóng tab...)
      if (isTyping) {
        typingTimers[timerKey] = setTimeout(
          () => setTyping(conversationId, userId, displayName, false),
          TYPING_EXPIRE_MS
        );
      }
    };

    socket.on(
      "user-typing",
      ({ conversationId, userId, displayName, isTyping }) => {
        setTyping(conversationId, userId, displayName, isTyping);
      }
    );

    // friend request realtime
    socket.on("friend-request-received", (request: FriendRequest) => {
      useFriendStore.getState().addReceivedRequest(request);
      toast.info(
        `${request.from?.displayName ?? "Ai đó"} đã gửi cho bạn lời mời kết bạn`
      );
    });

    socket.on(
      "friend-request-accepted",
      ({
        requestId,
        friend,
        acceptedByMe,
      }: {
        requestId: string;
        friend: Friend;
        acceptedByMe: boolean;
      }) => {
        const friendStore = useFriendStore.getState();
        friendStore.removeRequest(requestId);
        friendStore.addFriendToList(friend);

        if (!acceptedByMe) {
          toast.success(`${friend.displayName} đã chấp nhận lời mời kết bạn`);
        }
      }
    );

    // new message
    socket.on("new-message", ({ message, conversation, unreadCounts }) => {
      // người gửi vừa gửi xong thì không còn "đang gõ"
      setTyping(message.conversationId, message.senderId, "", false);

      useChatStore.getState().addMessage(message);

      const lastMessage = {
        _id: conversation.lastMessage._id,
        content: conversation.lastMessage.content,
        createdAt: conversation.lastMessage.createdAt,
        sender: {
          _id: conversation.lastMessage.senderId,
          displayName: "",
          avatarUrl: null,
        },
      };

      const updatedConversation = {
        ...conversation,
        lastMessage,
        unreadCounts,
      };

      if (useChatStore.getState().activeConversationId === message.conversationId) {
        useChatStore.getState().markAsSeen();
      }

      useChatStore.getState().updateConversation(updatedConversation);
    });

    // read message
    socket.on("read-message", ({ conversation, lastMessage }) => {
      const updated = {
        _id: conversation._id,
        lastMessage,
        lastMessageAt: conversation.lastMessageAt,
        unreadCounts: conversation.unreadCounts,
        seenBy: conversation.seenBy,
      };

      useChatStore.getState().updateConversation(updated);
    });

    // new group chat
    socket.on("new-group", (conversation) => {
      useChatStore.getState().addConvo(conversation);
      socket.emit("join-conversation", conversation._id);
    });
  },
  disconnectSocket: () => {
    const socket = get().socket;
    if (socket) {
      socket.disconnect();
      set({ socket: null });
    }
  },
}));
