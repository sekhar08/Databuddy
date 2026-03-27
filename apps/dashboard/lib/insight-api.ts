import type { Insight, HistoryInsightRow } from "@/lib/insight-types";
import { getUserTimezone } from "@/lib/timezone";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export const INSIGHT_QUERY_KEYS = {
	ai: "ai-insights",
	history: "insights-history",
	historyInfinite: "insights-history-infinite",
} as const;

export const INSIGHT_CACHE = {
	staleTime: 15 * 60 * 1000,
	gcTime: 30 * 60 * 1000,
	historyStaleTime: 5 * 60 * 1000,
} as const;

export interface InsightsAiResponse {
	success: boolean;
	insights: Insight[];
	source: "ai" | "fallback";
}

export interface InsightsHistoryPage {
	success: boolean;
	insights: HistoryInsightRow[];
	hasMore: boolean;
}

export async function fetchInsightsAi(
	organizationId: string
): Promise<InsightsAiResponse> {
	const res = await fetch(`${API_URL}/v1/insights/ai`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ organizationId, timezone: getUserTimezone() }),
		signal: AbortSignal.timeout(90_000),
	});

	if (!res.ok) {
		throw new Error(`Insights request failed: ${res.status}`);
	}

	const data = (await res.json()) as InsightsAiResponse;

	if (!data.success) {
		throw new Error("Insights response unsuccessful");
	}

	return data;
}

export async function fetchInsightsHistoryPage(
	organizationId: string,
	offset: number,
	limit = 50
): Promise<InsightsHistoryPage> {
	const params = new URLSearchParams({
		organizationId,
		limit: String(limit),
		offset: String(offset),
	});
	const res = await fetch(
		`${API_URL}/v1/insights/history?${params.toString()}`,
		{
			credentials: "include",
			signal: AbortSignal.timeout(30_000),
		}
	);

	if (!res.ok) {
		throw new Error(`Insights history failed: ${res.status}`);
	}

	return (await res.json()) as InsightsHistoryPage;
}

export interface ClearInsightsResponse {
	success: boolean;
	deleted: number;
	error?: string;
}

export async function clearInsightsHistory(
	organizationId: string
): Promise<ClearInsightsResponse> {
	const res = await fetch(`${API_URL}/v1/insights/clear`, {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ organizationId }),
		signal: AbortSignal.timeout(30_000),
	});

	const data = (await res.json()) as ClearInsightsResponse;

	if (!res.ok) {
		throw new Error(data.error ?? `Clear insights failed: ${res.status}`);
	}

	return data;
}
