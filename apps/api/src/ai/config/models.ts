import { createTracker } from "@databuddy/ai/vercel";
import { createGateway } from "ai";

const apiKey = process.env.AI_GATEWAY_API_KEY ?? process.env.AI_API_KEY ?? "";

const headers: Record<string, string> = {
	"HTTP-Referer": "https://www.databuddy.cc/",
	"X-Title": "Databuddy",
};

export const gateway = createGateway({
	apiKey,
	headers,
});

export const { track } = createTracker({
	apiKey: process.env.DATABUDDY_API_KEY,
	computeCosts: true,
});

const overrideModel: string | null = null;

const modelNames = {
	triage: overrideModel ?? "openai/gpt-oss-120b",
	analytics: overrideModel ?? "anthropic/claude-sonnet-4.5",
	advanced: overrideModel ?? "anthropic/claude-sonnet-4.5",
	perplexity: "perplexity/sonar-pro",
} as const;

const baseModels = {
	triage: track(gateway.chat(modelNames.triage)),
	analytics: track(gateway.chat(modelNames.analytics)),
	analyticsMcp: track(gateway.chat(modelNames.analytics)),
	advanced: track(gateway.chat(modelNames.advanced)),
	perplexity: track(gateway.chat(modelNames.perplexity)),
} as const;

export const models = {
	triage: baseModels.triage,
	analytics: baseModels.analytics,
	analyticsMcp: baseModels.analyticsMcp,
	advanced: baseModels.advanced,
	perplexity: baseModels.perplexity,
} as const;

export type ModelKey = keyof typeof models;
