import type { SystemModelMessage } from "ai";

/**
 * Wraps a system prompt string with Anthropic prompt caching.
 * The system prompt is large (~5-10K tokens) and mostly static across turns,
 * so caching gives ~90% input cost reduction on subsequent turns.
 */
export function cachedSystemPrompt(content: string): SystemModelMessage {
	return {
		role: "system",
		content,
		providerOptions: {
			anthropic: {
				cacheControl: { type: "ephemeral" },
			},
		},
	};
}
