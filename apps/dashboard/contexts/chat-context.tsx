"use client";

import { useChat as useAiSdkChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { createContext, useContext, useEffect, useMemo } from "react";
import { useAgentChatTransport } from "@/app/(main)/websites/[id]/agent/_components/hooks/use-agent-chat";
import {
	getMessagesFromLocal,
	saveMessagesToLocal,
} from "@/app/(main)/websites/[id]/agent/_components/hooks/use-chat-db";

type ChatContextType = ReturnType<typeof useAiSdkChat<UIMessage>>;

const ChatContext = createContext<ChatContextType | null>(null);

function getEffectiveInitialMessages(
	websiteId: string,
	chatId: string,
	serverMessages: UIMessage[]
): UIMessage[] {
	if (serverMessages.length > 0) return serverMessages;
	if (typeof window === "undefined") return [];
	return getMessagesFromLocal(websiteId, chatId);
}

export function ChatProvider({
	chatId,
	websiteId,
	initialMessages,
	children,
}: {
	chatId: string;
	websiteId: string;
	initialMessages: UIMessage[];
	children: React.ReactNode;
}) {
	const messagesToUse = useMemo(
		() => getEffectiveInitialMessages(websiteId, chatId, initialMessages),
		[websiteId, chatId, initialMessages]
	);

	const transport = useAgentChatTransport(chatId);
	const chat = useAiSdkChat<UIMessage>({
		id: chatId,
		transport,
		messages: messagesToUse,
	});

	useEffect(() => {
		saveMessagesToLocal(websiteId, chatId, chat.messages);
	}, [websiteId, chatId, chat.messages]);

	return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChat() {
	const chat = useContext(ChatContext);

	if (!chat) {
		throw new Error("useChat must be used within a `ChatProvider`");
	}

	return chat;
}

export function useChatStatus() {
	const { status } = useChat();
	return status;
}
