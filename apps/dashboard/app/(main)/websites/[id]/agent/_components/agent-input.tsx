"use client";

import { ClockCountdownIcon } from "@phosphor-icons/react/dist/ssr/ClockCountdown";
import { PaperPlaneRightIcon } from "@phosphor-icons/react/dist/ssr/PaperPlaneRight";
import { StopIcon } from "@phosphor-icons/react/dist/ssr/Stop";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";
import type { UIMessage } from "ai";
import { useAtom } from "jotai";
import { useParams } from "next/navigation";
import {
	Queue,
	QueueItem,
	QueueItemAction,
	QueueItemActions,
	QueueItemContent,
	QueueItemIndicator,
	QueueList,
	QueueSection,
	QueueSectionContent,
	QueueSectionLabel,
	QueueSectionTrigger,
} from "@/components/ai-elements/queue";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useChat, usePendingQueue } from "@/contexts/chat-context";
import { cn } from "@/lib/utils";
import { agentInputAtom } from "./agent-atoms";
import { useAgentChatId, useSetAgentChatId } from "./agent-chat-context";
import { AgentCommandMenu } from "./agent-command-menu";
import { useAgentCommands } from "./hooks/use-agent-commands";
import { useChatList } from "./hooks/use-chat-db";
import { useEnterSubmit } from "./hooks/use-enter-submit";

function getChatTitle(messages: UIMessage[], currentInput: string): string {
	const firstUserMsg = messages.find((m) => m.role === "user");
	if (firstUserMsg) {
		const text = firstUserMsg.parts
			.filter(
				(p): p is Extract<UIMessage["parts"][number], { type: "text" }> =>
					p.type === "text"
			)
			.map((p) => p.text)
			.join(" ")
			.trim();
		return text.slice(0, 100) || "New conversation";
	}
	return currentInput.slice(0, 100) || "New conversation";
}

export function AgentInput() {
	const { sendMessage, stop, status, messages } = useChat();
	const { messages: pendingMessages, removeAction } = usePendingQueue();
	const isLoading = status === "streaming" || status === "submitted";
	const [input, setInput] = useAtom(agentInputAtom);
	const agentCommands = useAgentCommands();
	const currentChatId = useAgentChatId();
	const setChatId = useSetAgentChatId();
	const { formRef, onKeyDown } = useEnterSubmit();
	const params = useParams();
	const websiteId = params.id as string;
	const { saveChat } = useChatList(websiteId);

	const handleSubmit = (e?: React.FormEvent) => {
		e?.preventDefault();
		if (!input.trim()) {
			return;
		}
		if (currentChatId) {
			setChatId(currentChatId);
		}

		const text = input.trim();
		const title = getChatTitle(messages, text);
		saveChat({ id: currentChatId, websiteId, title });

		sendMessage({ text });
		setInput("");
	};

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		agentCommands.handleInputChange(
			e.target.value,
			e.target.selectionStart ?? 0
		);
	};

	const handleStop = (e: React.MouseEvent) => {
		e.preventDefault();
		stop();
	};

	return (
		<div className="shrink-0 border-t">
			<div className="mx-auto max-w-4xl px-4 pt-3 pb-4">
				{pendingMessages.length > 0 ? (
					<PendingQueue
						messages={pendingMessages}
						onClear={stop}
						onRemove={removeAction}
					/>
				) : null}

				<div className="relative">
					<AgentCommandMenu {...agentCommands} />

					<form onSubmit={handleSubmit} ref={formRef}>
						<div
							className={cn(
								"rounded border border-border bg-background shadow-xs transition-all",
								"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50"
							)}
						>
							<Textarea
								className={cn(
									"min-h-0 resize-none border-0 bg-transparent px-3 pt-3 pb-3 text-base shadow-none",
									"focus-visible:border-0 focus-visible:bg-transparent focus-visible:shadow-none focus-visible:ring-0"
								)}
								maxRows={6}
								minRows={1}
								onChange={handleChange}
								onKeyDown={onKeyDown}
								placeholder="Ask anything about your analytics..."
								ref={agentCommands.inputRef}
								showFocusIndicator={false}
								value={input}
							/>

							<div className="flex items-center justify-between rounded-b bg-muted/50 px-3 py-1.5">
								<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
									<kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
										Enter
									</kbd>
									<span>send</span>
									<span className="mx-0.5 text-border">·</span>
									<kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">
										/
									</kbd>
									<span>commands</span>
								</div>

								<div className="flex items-center gap-1">
									{isLoading ? (
										<Button
											aria-label="Stop generation"
											className="size-8"
											onClick={handleStop}
											size="icon"
											type="button"
											variant="ghost"
										>
											<StopIcon className="size-4" weight="fill" />
										</Button>
									) : null}
									<Button
										aria-label={isLoading ? "Queue message" : "Send message"}
										className="size-8"
										disabled={!input.trim()}
										size="icon"
										type="submit"
									>
										<PaperPlaneRightIcon
											className="size-4"
											weight={input.trim() ? "fill" : "duotone"}
										/>
									</Button>
								</div>
							</div>
						</div>
					</form>
				</div>
			</div>
		</div>
	);
}

function PendingQueue({
	messages,
	onRemove,
	onClear,
}: {
	messages: string[];
	onRemove: (index: number) => void;
	onClear: () => void;
}) {
	return (
		<Queue className="mb-3 rounded shadow-none">
			<QueueSection>
				<div className="flex items-center gap-2">
					<QueueSectionTrigger className="flex-1 rounded">
						<QueueSectionLabel
							count={messages.length}
							icon={
								<ClockCountdownIcon className="size-3.5" weight="duotone" />
							}
							label="queued"
						/>
					</QueueSectionTrigger>
					{messages.length > 1 ? (
						<button
							className="text-muted-foreground/60 text-xs hover:text-foreground"
							onClick={onClear}
							type="button"
						>
							Clear all
						</button>
					) : null}
				</div>
				<QueueSectionContent>
					<QueueList>
						{messages.map((text, index) => (
							<QueueItem
								className="rounded"
								key={`${index}-${text.slice(0, 20)}`}
							>
								<div className="flex items-center gap-2">
									<QueueItemIndicator />
									<QueueItemContent className="flex-1">{text}</QueueItemContent>
									<QueueItemActions>
										<QueueItemAction
											aria-label="Remove queued message"
											onClick={() => onRemove(index)}
										>
											<XIcon className="size-3.5" />
										</QueueItemAction>
									</QueueItemActions>
								</div>
							</QueueItem>
						))}
					</QueueList>
				</QueueSectionContent>
			</QueueSection>
		</Queue>
	);
}
