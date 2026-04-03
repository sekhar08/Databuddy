"use client";

import { BrainIcon } from "@phosphor-icons/react";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { AIComponent } from "@/components/ai-elements/ai-component";
import { ToolStep } from "@/components/ai-elements/chain-of-thought";
import {
	Message,
	MessageContent,
	MessageResponse,
} from "@/components/ai-elements/message";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { useChat } from "@/contexts/chat-context";
import { parseContentSegments } from "@/lib/ai-components";
import { formatToolLabel } from "@/lib/tool-display";
import { cn } from "@/lib/utils";
import { AgentErrorMessage } from "./agent-error-message";
import { useChatStatus } from "./hooks/use-chat-status";

type MessagePart = UIMessage["parts"][number];

type ToolMessagePart = MessagePart & {
	type: string;
	input?: Record<string, unknown>;
	output?: unknown;
	state?: string;
};

function isToolPart(part: MessagePart): part is ToolMessagePart {
	return part.type?.startsWith("tool-") ?? false;
}

const TOOL_PREFIX_REGEX = /^tool-/;

function getToolName(part: ToolMessagePart): string {
	return part.type.replace(TOOL_PREFIX_REGEX, "");
}

function getReasoningText(part: MessagePart): string {
	const reasoning = part as {
		text?: string;
		content?: string;
	};

	return (
		reasoning.text ||
		reasoning.content ||
		JSON.stringify(part, null, 2) ||
		"Thinking through the request."
	);
}

function ReasoningMessage({
	part,
	isStreaming,
}: {
	part: MessagePart;
	isStreaming: boolean;
}) {
	const [hasBeenStreaming, setHasBeenStreaming] = useState(false);
	useEffect(() => {
		if (isStreaming) {
			setHasBeenStreaming(true);
		}
	}, [isStreaming]);

	return (
		<Reasoning
			defaultOpen={isStreaming || hasBeenStreaming}
			isStreaming={isStreaming}
		>
			<ReasoningTrigger />
			<ReasoningContent>{getReasoningText(part)}</ReasoningContent>
		</Reasoning>
	);
}

/** Merge consecutive identical tool UI labels (same model re-calling the tool). */
function mergeConsecutiveToolStepsForDisplay(
	tools: ToolMessagePart[]
): Array<{ repeatCount: number; tool: ToolMessagePart }> {
	const merged: Array<{ repeatCount: number; tool: ToolMessagePart }> = [];
	for (const tool of tools) {
		const toolName = getToolName(tool);
		const label = formatToolLabel(toolName, tool.input ?? {});
		const last = merged.at(-1);
		if (
			last &&
			formatToolLabel(getToolName(last.tool), last.tool.input ?? {}) === label
		) {
			last.repeatCount += 1;
			last.tool = tool;
		} else {
			merged.push({ repeatCount: 1, tool });
		}
	}
	return merged;
}

function collectToolGroups(parts: MessagePart[]) {
	const result: Array<MessagePart | ToolMessagePart[]> = [];
	let toolBuffer: ToolMessagePart[] = [];

	for (const part of parts) {
		if (isToolPart(part)) {
			toolBuffer.push(part);
		} else {
			if (toolBuffer.length > 0) {
				result.push(toolBuffer);
				toolBuffer = [];
			}
			result.push(part);
		}
	}

	if (toolBuffer.length > 0) {
		result.push(toolBuffer);
	}

	return result;
}

function renderToolGroup(
	tools: ToolMessagePart[],
	key: string,
	isLastGroup: boolean,
	isStreaming: boolean
) {
	const merged = mergeConsecutiveToolStepsForDisplay(tools);

	return (
		<div className="space-y-0 py-1" key={key}>
			{merged.map((entry, idx) => {
				const toolName = getToolName(entry.tool);
				const toolInput = entry.tool.input ?? {};
				const isLast = idx === merged.length - 1;
				const isActive =
					isLastGroup && isStreaming && isLast && !entry.tool.output;
				const baseLabel = formatToolLabel(toolName, toolInput);
				const label =
					entry.repeatCount > 1
						? `${baseLabel} · ${entry.repeatCount}×`
						: baseLabel;
				return (
					<ToolStep
						key={`${key}-${idx}`}
						label={label}
						status={isActive ? "active" : "complete"}
					/>
				);
			})}
		</div>
	);
}

function renderMessagePart(
	part: MessagePart | ToolMessagePart[],
	partIndex: number,
	messageId: string,
	isLastMessage: boolean,
	isStreaming: boolean,
	role: UIMessage["role"]
) {
	const key = `${messageId}-${partIndex}`;
	const isCurrentlyStreaming = isLastMessage && isStreaming;
	const mode =
		role === "user" || !isCurrentlyStreaming ? "static" : "streaming";

	if (Array.isArray(part)) {
		return renderToolGroup(part, key, isLastMessage, isCurrentlyStreaming);
	}

	if (part.type === "reasoning") {
		return (
			<ReasoningMessage
				isStreaming={isCurrentlyStreaming}
				key={key}
				part={part}
			/>
		);
	}

	if (part.type === "text") {
		const textPart = part as { text: string };
		if (!textPart.text?.trim()) {
			return null;
		}

		const { segments } = parseContentSegments(textPart.text);
		if (segments.length === 0) {
			return null;
		}

		return (
			<div className="space-y-4" key={key}>
				{segments.map((segment, idx) => {
					if (segment.type === "text") {
						return (
							<MessageResponse
								isAnimating={isCurrentlyStreaming}
								key={`${key}-text-${idx}`}
								mode={mode}
							>
								{segment.content}
							</MessageResponse>
						);
					}
					// Both complete and streaming components render via AIComponent
					return (
						<AIComponent
							input={segment.content}
							key={`${key}-component-${idx}`}
							streaming={segment.type === "streaming-component"}
						/>
					);
				})}
			</div>
		);
	}

	if (isToolPart(part)) {
		const toolName = getToolName(part as ToolMessagePart);
		const toolInput = (part as ToolMessagePart).input ?? {};
		const isActive = isCurrentlyStreaming && !(part as ToolMessagePart).output;
		return (
			<div className="py-1" key={key}>
				<ToolStep
					label={formatToolLabel(toolName, toolInput)}
					status={isActive ? "active" : "complete"}
				/>
			</div>
		);
	}

	return null;
}

function AgentChatErrorPanel({
	clearError,
	error,
	onRetryAction,
}: {
	clearError: () => void;
	error: Error | undefined;
	onRetryAction: () => Promise<void>;
}) {
	return (
		<AgentErrorMessage
			error={error}
			onDismissAction={clearError}
			onRetryAction={onRetryAction}
		/>
	);
}

function getTextFromUserMessage(message: UIMessage): string {
	if (!message.parts?.length) {
		return "";
	}
	return message.parts
		.filter((p): p is { type: "text"; text: string } => p.type === "text")
		.map((p) => p.text)
		.join("");
}

export function AgentMessages() {
	const { status, messages, error, regenerate, clearError, sendMessage } =
		useChat();
	const hasError = status === "error";
	const chatStatus = useChatStatus(messages, status);
	const isStreaming = status === "streaming" || status === "submitted";
	const lastMessage = messages.at(-1);
	const errorAfterUser =
		hasError && lastMessage?.role === "user" && messages.length > 0;

	if (messages.length === 0) {
		return null;
	}

	const retry = async () => {
		const last = messages.at(-1);
		if (last?.role === "user") {
			const text = getTextFromUserMessage(last);
			if (text.trim()) {
				await sendMessage({ messageId: last.id, text });
				return;
			}
		}
		await regenerate();
	};

	return (
		<>
			{messages.map((message, index) => {
				const isLastMessage = index === messages.length - 1;
				const showError =
					isLastMessage && hasError && message.role === "assistant";

				const groupedParts = message.parts
					? collectToolGroups(message.parts)
					: [];

				return (
					<Message from={message.role} key={message.id}>
						<MessageContent
							className={cn(message.role === "assistant" ? "w-full" : "")}
						>
							{groupedParts.map((part, partIndex) =>
								renderMessagePart(
									part,
									partIndex,
									message.id,
									isLastMessage,
									isStreaming,
									message.role
								)
							)}

							{showError ? (
								<AgentChatErrorPanel
									clearError={clearError}
									error={error}
									onRetryAction={retry}
								/>
							) : null}
						</MessageContent>
					</Message>
				);
			})}

			{errorAfterUser ? (
				<Message from="assistant">
					<MessageContent className="w-full">
						<AgentChatErrorPanel
							clearError={clearError}
							error={error}
							onRetryAction={retry}
						/>
					</MessageContent>
				</Message>
			) : null}

			{isStreaming &&
			!chatStatus.hasTextContent &&
			chatStatus.displayMessage == null ? (
				<StreamingIndicator />
			) : null}
		</>
	);
}

function StreamingIndicator() {
	return (
		<div
			className="fade-in flex w-full animate-in items-center gap-2 duration-200"
			data-role="assistant"
		>
			<BrainIcon
				className="size-4 shrink-0 text-muted-foreground"
				weight="duotone"
			/>
			<Shimmer as="span" className="text-sm" duration={1} spread={4}>
				Thinking
			</Shimmer>
		</div>
	);
}
