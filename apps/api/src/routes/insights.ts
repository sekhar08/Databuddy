import { auth } from "@databuddy/auth";
import {
	analyticsInsights,
	and,
	annotations,
	db,
	desc,
	eq,
	gte,
	inArray,
	insightUserFeedback,
	isNull,
	member,
	websites,
} from "@databuddy/db";
import { getRedisCache } from "@databuddy/redis";
import { generateText, Output } from "ai";
import dayjs from "dayjs";
import { Elysia, t } from "elysia";
import { useLogger } from "evlog/elysia";
import { z } from "zod";
import { gateway } from "../ai/config/models";
import { storeAnalyticsSummary } from "../lib/supermemory";
import { mergeWideEvent } from "../lib/tracing";
import { executeQuery } from "../query";

const CACHE_TTL = 900;
const CACHE_KEY_PREFIX = "ai-insights";
const TIMEOUT_MS = 60_000;
const MAX_WEBSITES = 5;
const CONCURRENCY = 3;
const GENERATION_COOLDOWN_HOURS = 6;
const RECENT_INSIGHTS_LOOKBACK_DAYS = 14;
const RECENT_INSIGHTS_PROMPT_LIMIT = 12;

const insightSchema = z.object({
	title: z
		.string()
		.describe(
			"Brief headline under 60 chars with the key number, e.g. 'Visitors up 23% week-over-week'"
		),
	description: z
		.string()
		.describe(
			"2-3 sentences: what changed and why it might matter, with specific numbers from BOTH periods. Explain cause only when grounded in the data or annotations."
		),
	suggestion: z
		.string()
		.describe(
			"Required prescriptive 'now what': one or two sentences telling the user what to do next (product, marketing, or ops). Tie to the metric (e.g. add a CTA, capture email from volatile channel, prioritize top error). Never generic: no 'monitor', 'keep watching', or 'consider reviewing' without a concrete step."
		),
	severity: z.enum(["critical", "warning", "info"]),
	sentiment: z
		.enum(["positive", "neutral", "negative"])
		.describe(
			"positive = improving metric, neutral = stable, negative = declining or broken"
		),
	priority: z
		.number()
		.min(1)
		.max(10)
		.describe(
			"1-10 from actionability × business impact, NOT raw % magnitude. User-facing errors, conversion/session drops, or reliability issues outrank vanity traffic spikes. A 5% drop in a meaningful engagement metric can score higher than a 70% visitor increase with no conversion context. Reserve 8-10 for issues that hurt users or revenue signals in the data."
		),
	type: z.enum([
		"error_spike",
		"new_errors",
		"vitals_degraded",
		"custom_event_spike",
		"traffic_drop",
		"traffic_spike",
		"bounce_rate_change",
		"engagement_change",
		"referrer_change",
		"page_trend",
		"positive_trend",
		"performance",
		"uptime_issue",
	]),
	changePercent: z
		.number()
		.optional()
		.describe("Percentage change between periods, e.g. -15.5 for a 15.5% drop"),
});

const insightsOutputSchema = z.object({
	insights: z
		.array(insightSchema)
		.max(3)
		.describe(
			"1-3 insights ranked by actionability × business impact. Skip repeating a narrative already listed under recently reported insights unless the change is materially new."
		),
});

type ParsedInsight = z.infer<typeof insightSchema>;

interface WebsiteInsight extends ParsedInsight {
	id: string;
	websiteId: string;
	websiteName: string | null;
	websiteDomain: string;
	link: string;
}

interface InsightsPayload {
	insights: WebsiteInsight[];
	source: "ai" | "fallback";
}

interface PeriodData {
	summary: Record<string, unknown>[];
	topPages: Record<string, unknown>[];
	errorSummary: Record<string, unknown>[];
	topReferrers: Record<string, unknown>[];
}

interface WeekOverWeekPeriod {
	current: { from: string; to: string };
	previous: { from: string; to: string };
}

function getWeekOverWeekPeriod(): WeekOverWeekPeriod {
	const now = dayjs();
	return {
		current: {
			from: now.subtract(7, "day").format("YYYY-MM-DD"),
			to: now.format("YYYY-MM-DD"),
		},
		previous: {
			from: now.subtract(14, "day").format("YYYY-MM-DD"),
			to: now.subtract(7, "day").format("YYYY-MM-DD"),
		},
	};
}

async function fetchPeriodData(
	websiteId: string,
	domain: string,
	from: string,
	to: string,
	timezone: string
): Promise<PeriodData> {
	const base = { projectId: websiteId, from, to, timezone };

	const [summary, topPages, errorSummary, topReferrers] =
		await Promise.allSettled([
			executeQuery({ ...base, type: "summary_metrics" }, domain, timezone),
			executeQuery({ ...base, type: "top_pages", limit: 10 }, domain, timezone),
			executeQuery({ ...base, type: "error_summary" }, domain, timezone),
			executeQuery(
				{ ...base, type: "top_referrers", limit: 10 },
				domain,
				timezone
			),
		]);

	return {
		summary: summary.status === "fulfilled" ? summary.value : [],
		topPages: topPages.status === "fulfilled" ? topPages.value : [],
		errorSummary: errorSummary.status === "fulfilled" ? errorSummary.value : [],
		topReferrers: topReferrers.status === "fulfilled" ? topReferrers.value : [],
	};
}

function formatDataForPrompt(
	current: PeriodData,
	previous: PeriodData,
	currentRange: { from: string; to: string },
	previousRange: { from: string; to: string }
): string {
	const sections: string[] = [];

	sections.push(
		`## Current Period (${currentRange.from} to ${currentRange.to})`
	);
	sections.push(`### Summary\n${JSON.stringify(current.summary)}`);
	if (current.topPages.length > 0) {
		sections.push(`### Top Pages\n${JSON.stringify(current.topPages)}`);
	}
	if (current.errorSummary.length > 0) {
		sections.push(`### Errors\n${JSON.stringify(current.errorSummary)}`);
	}
	if (current.topReferrers.length > 0) {
		sections.push(`### Top Referrers\n${JSON.stringify(current.topReferrers)}`);
	}

	sections.push(
		`\n## Previous Period (${previousRange.from} to ${previousRange.to})`
	);
	sections.push(`### Summary\n${JSON.stringify(previous.summary)}`);
	if (previous.topPages.length > 0) {
		sections.push(`### Top Pages\n${JSON.stringify(previous.topPages)}`);
	}
	if (previous.errorSummary.length > 0) {
		sections.push(`### Errors\n${JSON.stringify(previous.errorSummary)}`);
	}

	return sections.join("\n\n");
}

async function fetchRecentAnnotations(websiteId: string): Promise<string> {
	const since = dayjs().subtract(14, "day").toDate();

	const rows = await db
		.select({
			text: annotations.text,
			xValue: annotations.xValue,
			tags: annotations.tags,
		})
		.from(annotations)
		.where(
			and(
				eq(annotations.websiteId, websiteId),
				gte(annotations.xValue, since),
				isNull(annotations.deletedAt)
			)
		)
		.orderBy(annotations.xValue)
		.limit(20);

	if (rows.length === 0) {
		return "";
	}

	const lines = rows.map((r) => {
		const date = dayjs(r.xValue).format("YYYY-MM-DD");
		const tags = r.tags?.length ? ` [${r.tags.join(", ")}]` : "";
		return `- ${date}: ${r.text}${tags}`;
	});

	return `\n\nUser annotations (known events that may explain changes):\n${lines.join("\n")}`;
}

async function fetchRecentInsightsForPrompt(
	organizationId: string,
	websiteId: string
): Promise<string> {
	const since = dayjs().subtract(RECENT_INSIGHTS_LOOKBACK_DAYS, "day").toDate();

	const rows = await db
		.select({
			title: analyticsInsights.title,
			type: analyticsInsights.type,
			createdAt: analyticsInsights.createdAt,
		})
		.from(analyticsInsights)
		.where(
			and(
				eq(analyticsInsights.organizationId, organizationId),
				eq(analyticsInsights.websiteId, websiteId),
				gte(analyticsInsights.createdAt, since)
			)
		)
		.orderBy(desc(analyticsInsights.createdAt))
		.limit(RECENT_INSIGHTS_PROMPT_LIMIT);

	if (rows.length === 0) {
		return "";
	}

	const lines = rows.map(
		(r) =>
			`- [${r.type}] ${r.title} (${dayjs(r.createdAt).format("YYYY-MM-DD")})`
	);

	return `\n\n## Recently reported insights for this website (avoid repeating the same narrative unless something materially changed)\n${lines.join("\n")}`;
}

const INSIGHTS_SYSTEM_PROMPT = `You are an analytics insights engine. Your job is to find the 1-3 most significant findings from week-over-week website data, written like an analyst: descriptive where needed, but every insight MUST include a prescriptive "so what / now what" in the suggestion field.

Priority scoring (priority 1-10):
- Score by actionability × business impact, NOT by how large the percentage move is. Traffic spikes without conversion or outcome context are lower priority than errors, session/engagement collapses, or clear negative trends affecting users.
- Operational health (errors, reliability) often matters more than vanity traffic growth. A moderate error-rate improvement during high traffic can be high value.
- Do not assign 8-10 to pure volume spikes unless the data also shows a linked risk or opportunity worth acting on.

Significance thresholds (for what to mention):
- Traffic (pageviews/visitors/sessions): <5% change = only mention if nothing else notable. 5-15% = worth noting. >15% = significant. >30% = notable volume change.
- Errors: new error types = always report. Error rate up >0.5% = warning. Error rate up >2% = critical.
- Bounce rate: change >5 percentage points = notable.
- Pages: new page entering top 10 or page dropping out = notable. Individual page change >25% = significant.
- Referrers: new source appearing or major source declining >20% = notable.

Anti-redundancy:
- If the user message includes a "Recently reported insights" section, treat those as already surfaced. Do NOT output a new insight that tells the same story (same underlying signal and direction) unless the narrative would be materially different (e.g. new root cause, reversal, or threshold crossed). Prefer novel angles or omit.

Data boundaries:
- Only use metrics present in the JSON (summary, pages, errors, referrers). Do not invent funnel conversion rates, MRR, revenue, cohort retention, or signup counts unless they appear in the data.
- If conversion or goal data appears in summary_metrics, you may connect traffic to outcomes. If absent, do not fabricate funnel or revenue insights.

Suggestion field (required quality):
- Must answer "what should we do next?" in one or two sentences: concrete product, marketing, or engineering action tied to the numbers.
- Bad: "Monitor traffic", "Keep an eye on this", "Consider reviewing analytics."
- Good: tie to pages, channels, CTAs, error classes, or experiments suggested by the data.

Rules:
- Every insight MUST include specific numbers from both periods where applicable.
- If annotations explain a change, mention it but still report the data.
- If everything is stable, return ONE positive/neutral insight (e.g. "Steady at 2,400 weekly visitors") with a light suggestion if appropriate.
- Never fabricate or round numbers beyond what's in the data`;

async function analyzeWebsite(
	organizationId: string,
	userId: string,
	websiteId: string,
	domain: string,
	timezone: string,
	period: WeekOverWeekPeriod
): Promise<ParsedInsight[]> {
	const currentRange = period.current;
	const previousRange = period.previous;

	const [current, previous, annotationContext, recentInsightsBlock] =
		await Promise.all([
			fetchPeriodData(
				websiteId,
				domain,
				currentRange.from,
				currentRange.to,
				timezone
			),
			fetchPeriodData(
				websiteId,
				domain,
				previousRange.from,
				previousRange.to,
				timezone
			),
			fetchRecentAnnotations(websiteId),
			fetchRecentInsightsForPrompt(organizationId, websiteId),
		]);

	const hasData = current.summary.length > 0 || current.topPages.length > 0;
	if (!hasData) {
		return [];
	}

	const dataSection = formatDataForPrompt(
		current,
		previous,
		currentRange,
		previousRange
	);

	const prompt = `Analyze this website's week-over-week data and return insights.\n\n${dataSection}${annotationContext}${recentInsightsBlock}`;

	try {
		const result = await generateText({
			model: gateway.chat("anthropic/claude-opus-4.6"),
			output: Output.object({ schema: insightsOutputSchema }),
			system: INSIGHTS_SYSTEM_PROMPT,
			prompt,
			temperature: 0.2,
			abortSignal: AbortSignal.timeout(TIMEOUT_MS),
			experimental_telemetry: {
				isEnabled: true,
				functionId: "databuddy.insights.analyze_website",
				metadata: {
					source: "insights",
					feature: "smart_insights",
					organizationId,
					userId,
					websiteId,
					websiteDomain: domain,
					timezone,
				},
			},
		});

		if (!result.output) {
			useLogger().warn("No structured output from insights model", {
				insights: { websiteId },
			});
			return [];
		}

		return result.output.insights;
	} catch (error) {
		useLogger().warn("Failed to generate insights", {
			insights: { websiteId, error },
		});
		return [];
	}
}

async function processInBatches<T, R>(
	items: T[],
	action: (item: T) => Promise<R>,
	limit: number
): Promise<R[]> {
	const results: R[] = [];
	const pending = [...items];

	async function run() {
		while (pending.length > 0) {
			const item = pending.shift();
			if (item !== undefined) {
				results.push(await action(item));
			}
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(limit, items.length) }, () => run())
	);
	return results;
}

async function getRecentInsightsFromDb(
	organizationId: string
): Promise<WebsiteInsight[] | null> {
	const cutoff = dayjs().subtract(GENERATION_COOLDOWN_HOURS, "hour").toDate();

	const rows = await db
		.select({
			id: analyticsInsights.id,
			websiteId: analyticsInsights.websiteId,
			websiteName: websites.name,
			websiteDomain: websites.domain,
			title: analyticsInsights.title,
			description: analyticsInsights.description,
			suggestion: analyticsInsights.suggestion,
			severity: analyticsInsights.severity,
			sentiment: analyticsInsights.sentiment,
			type: analyticsInsights.type,
			priority: analyticsInsights.priority,
			changePercent: analyticsInsights.changePercent,
			createdAt: analyticsInsights.createdAt,
		})
		.from(analyticsInsights)
		.innerJoin(websites, eq(analyticsInsights.websiteId, websites.id))
		.where(
			and(
				eq(analyticsInsights.organizationId, organizationId),
				gte(analyticsInsights.createdAt, cutoff),
				isNull(websites.deletedAt)
			)
		)
		.orderBy(desc(analyticsInsights.priority))
		.limit(10);

	if (rows.length === 0) {
		return null;
	}

	return rows.map(
		(r): WebsiteInsight => ({
			id: r.id,
			websiteId: r.websiteId,
			websiteName: r.websiteName,
			websiteDomain: r.websiteDomain,
			link: `/websites/${r.websiteId}`,
			title: r.title,
			description: r.description,
			suggestion: r.suggestion,
			severity: r.severity as ParsedInsight["severity"],
			sentiment: r.sentiment as ParsedInsight["sentiment"],
			type: r.type as ParsedInsight["type"],
			priority: r.priority,
			changePercent: r.changePercent ?? undefined,
		})
	);
}

function getRedis() {
	try {
		return getRedisCache();
	} catch {
		return null;
	}
}

async function invalidateInsightsCacheForOrg(
	organizationId: string
): Promise<void> {
	const redis = getRedis();
	if (!redis) {
		return;
	}
	const pattern = `${CACHE_KEY_PREFIX}:${organizationId}:*`;
	let cursor = "0";
	try {
		do {
			const [nextCursor, keys] = (await redis.scan(
				cursor,
				"MATCH",
				pattern,
				"COUNT",
				100
			)) as [string, string[]];
			cursor = nextCursor;
			if (keys.length > 0) {
				await redis.del(...keys);
			}
		} while (cursor !== "0");
	} catch {
		// cache best-effort
	}
}

export const insights = new Elysia({ prefix: "/v1/insights" })
	.derive(async ({ request }) => {
		const session = await auth.api.getSession({ headers: request.headers });
		return { user: session?.user ?? null };
	})
	.onBeforeHandle(({ user, set }) => {
		if (!user) {
			mergeWideEvent({ insights_ai_auth: "unauthorized" });
			set.status = 401;
			return {
				success: false,
				error: "Authentication required",
				code: "AUTH_REQUIRED",
			};
		}
	})
	.get(
		"/history",
		async ({ query, user, set }) => {
			const userId = user?.id;
			if (!userId) {
				return { success: false, error: "User ID required", insights: [] };
			}

			const { organizationId, websiteId: websiteIdFilter } = query;
			const limitParsed = Number.parseInt(query.limit ?? "50", 10);
			const limit = Number.isFinite(limitParsed)
				? Math.min(Math.max(limitParsed, 1), 100)
				: 50;
			const offsetParsed = Number.parseInt(query.offset ?? "0", 10);
			const offset = Number.isFinite(offsetParsed)
				? Math.max(offsetParsed, 0)
				: 0;

			mergeWideEvent({ insights_history_org_id: organizationId });

			const memberships = await db.query.member.findMany({
				where: eq(member.userId, userId),
				columns: { organizationId: true },
			});

			const orgIds = new Set(memberships.map((m) => m.organizationId));
			if (!orgIds.has(organizationId)) {
				mergeWideEvent({ insights_history_access: "denied" });
				set.status = 403;
				return {
					success: false,
					error: "Access denied to this organization",
					insights: [],
				};
			}

			const whereClause = websiteIdFilter
				? and(
						eq(analyticsInsights.organizationId, organizationId),
						eq(analyticsInsights.websiteId, websiteIdFilter),
						isNull(websites.deletedAt)
					)
				: and(
						eq(analyticsInsights.organizationId, organizationId),
						isNull(websites.deletedAt)
					);

			const rows = await db
				.select({
					id: analyticsInsights.id,
					runId: analyticsInsights.runId,
					websiteId: analyticsInsights.websiteId,
					websiteName: websites.name,
					websiteDomain: websites.domain,
					title: analyticsInsights.title,
					description: analyticsInsights.description,
					suggestion: analyticsInsights.suggestion,
					severity: analyticsInsights.severity,
					sentiment: analyticsInsights.sentiment,
					type: analyticsInsights.type,
					priority: analyticsInsights.priority,
					changePercent: analyticsInsights.changePercent,
					createdAt: analyticsInsights.createdAt,
					currentPeriodFrom: analyticsInsights.currentPeriodFrom,
					currentPeriodTo: analyticsInsights.currentPeriodTo,
					previousPeriodFrom: analyticsInsights.previousPeriodFrom,
					previousPeriodTo: analyticsInsights.previousPeriodTo,
					timezone: analyticsInsights.timezone,
				})
				.from(analyticsInsights)
				.innerJoin(websites, eq(analyticsInsights.websiteId, websites.id))
				.where(whereClause)
				.orderBy(desc(analyticsInsights.createdAt))
				.limit(limit)
				.offset(offset);

			const insights = rows.map((r) => ({
				id: r.id,
				runId: r.runId,
				websiteId: r.websiteId,
				websiteName: r.websiteName,
				websiteDomain: r.websiteDomain,
				link: `/websites/${r.websiteId}`,
				title: r.title,
				description: r.description,
				suggestion: r.suggestion,
				severity: r.severity,
				sentiment: r.sentiment,
				type: r.type,
				priority: r.priority,
				changePercent: r.changePercent ?? undefined,
				createdAt: r.createdAt.toISOString(),
				currentPeriodFrom: r.currentPeriodFrom,
				currentPeriodTo: r.currentPeriodTo,
				previousPeriodFrom: r.previousPeriodFrom,
				previousPeriodTo: r.previousPeriodTo,
				timezone: r.timezone,
			}));

			return {
				success: true,
				insights,
				hasMore: rows.length === limit,
			};
		},
		{
			query: t.Object({
				organizationId: t.String(),
				limit: t.Optional(t.String()),
				offset: t.Optional(t.String()),
				websiteId: t.Optional(t.String()),
			}),
		}
	)
	.post(
		"/clear",
		async ({ body, user, set }) => {
			const userId = user?.id;
			if (!userId) {
				return { success: false, error: "User ID required", deleted: 0 };
			}

			const { organizationId } = body;
			mergeWideEvent({ insights_clear_org_id: organizationId });

			const memberships = await db.query.member.findMany({
				where: eq(member.userId, userId),
				columns: { organizationId: true },
			});

			const orgIds = new Set(memberships.map((m) => m.organizationId));
			if (!orgIds.has(organizationId)) {
				set.status = 403;
				return {
					success: false,
					error: "Access denied to this organization",
					deleted: 0,
				};
			}

			const idRows = await db
				.select({ id: analyticsInsights.id })
				.from(analyticsInsights)
				.where(eq(analyticsInsights.organizationId, organizationId));

			const ids = idRows.map((r) => r.id);

			if (ids.length > 0) {
				await db
					.delete(insightUserFeedback)
					.where(
						and(
							eq(insightUserFeedback.organizationId, organizationId),
							inArray(insightUserFeedback.insightId, ids)
						)
					);
				await db
					.delete(analyticsInsights)
					.where(eq(analyticsInsights.organizationId, organizationId));
			}

			await invalidateInsightsCacheForOrg(organizationId);
			mergeWideEvent({ insights_cleared: ids.length });

			return { success: true, deleted: ids.length };
		},
		{
			body: t.Object({
				organizationId: t.String(),
			}),
		}
	)
	.post(
		"/ai",
		async ({ body, user, set }) => {
			const userId = user?.id;
			if (!userId) {
				mergeWideEvent({ insights_ai_error: "missing_user_id" });
				return { success: false, error: "User ID required", insights: [] };
			}

			const { organizationId, timezone = "UTC" } = body;
			mergeWideEvent({
				insights_org_id: organizationId,
				insights_timezone: timezone,
			});

			const redis = getRedis();
			const cacheKey = `${CACHE_KEY_PREFIX}:${organizationId}:${timezone}`;

			if (redis) {
				try {
					const cached = await redis.get(cacheKey);
					if (cached) {
						mergeWideEvent({ insights_cache: "hit" });
						const payload = JSON.parse(cached) as InsightsPayload;
						return { success: true, ...payload };
					}
				} catch {
					// proceed without cache
				}
			}

			mergeWideEvent({ insights_cache: "miss" });

			const memberships = await db.query.member.findMany({
				where: eq(member.userId, userId),
				columns: { organizationId: true },
			});

			const orgIds = new Set(memberships.map((m) => m.organizationId));
			if (!orgIds.has(organizationId)) {
				mergeWideEvent({ insights_access: "denied" });
				set.status = 403;
				return {
					success: false,
					error: "Access denied to this organization",
					insights: [],
				};
			}

			const recentInsights = await getRecentInsightsFromDb(organizationId);
			if (recentInsights) {
				mergeWideEvent({
					insights_returned: recentInsights.length,
					insights_source: "db_cooldown",
				});
				const payload: InsightsPayload = {
					insights: recentInsights,
					source: "ai",
				};
				if (redis) {
					redis
						.setex(cacheKey, CACHE_TTL, JSON.stringify(payload))
						.catch(() => {});
				}
				return { success: true, ...payload };
			}

			const sites = await db.query.websites.findMany({
				where: and(
					eq(websites.organizationId, organizationId),
					isNull(websites.deletedAt)
				),
				columns: { id: true, name: true, domain: true },
			});

			if (sites.length === 0) {
				mergeWideEvent({ insights_websites: 0 });
				return { success: true, insights: [], source: "ai" };
			}

			try {
				const period = getWeekOverWeekPeriod();
				const groups = await processInBatches(
					sites.slice(0, MAX_WEBSITES),
					async (site: { id: string; name: string | null; domain: string }) => {
						const results = await analyzeWebsite(
							organizationId,
							userId,
							site.id,
							site.domain,
							timezone,
							period
						);
						return results.map(
							(insight, i): WebsiteInsight => ({
								...insight,
								id: `${site.id}-${i}`,
								websiteId: site.id,
								websiteName: site.name,
								websiteDomain: site.domain,
								link: `/websites/${site.id}`,
							})
						);
					},
					CONCURRENCY
				);

				const sorted = groups
					.flat()
					.sort((a, b) => b.priority - a.priority)
					.slice(0, 10);

				const runId = crypto.randomUUID();
				let finalInsights: WebsiteInsight[] = sorted;
				if (sorted.length > 0) {
					const rows = sorted.map((insight) => ({
						id: crypto.randomUUID(),
						organizationId,
						websiteId: insight.websiteId,
						runId,
						title: insight.title,
						description: insight.description,
						suggestion: insight.suggestion,
						severity: insight.severity,
						sentiment: insight.sentiment,
						type: insight.type,
						priority: insight.priority,
						changePercent: insight.changePercent ?? null,
						timezone,
						currentPeriodFrom: period.current.from,
						currentPeriodTo: period.current.to,
						previousPeriodFrom: period.previous.from,
						previousPeriodTo: period.previous.to,
					}));

					try {
						await db.insert(analyticsInsights).values(rows);
					} catch (error) {
						useLogger().warn("Failed to persist analytics insights", {
							insights: { organizationId, error },
						});
					}

					finalInsights = sorted.map((insight, i) => {
						const row = rows[i];
						return row ? { ...insight, id: row.id } : insight;
					});
				}

				for (const site of sites.slice(0, MAX_WEBSITES)) {
					const siteInsights = finalInsights.filter(
						(s) => s.websiteId === site.id
					);
					if (siteInsights.length > 0) {
						const summary = siteInsights
							.map(
								(s) =>
									`[${s.severity}] ${s.title}: ${s.description} Suggestion: ${s.suggestion}`
							)
							.join("\n");
						storeAnalyticsSummary(
							`Weekly insights for ${site.domain} (${dayjs().format("YYYY-MM-DD")}):\n${summary}`,
							site.id,
							{ period: "weekly" }
						);
					}
				}

				const payload: InsightsPayload = {
					insights: finalInsights,
					source: "ai",
				};

				if (redis && finalInsights.length > 0) {
					redis
						.setex(cacheKey, CACHE_TTL, JSON.stringify(payload))
						.catch(() => {});
				}

				if (redis && finalInsights.length === 0) {
					redis
						.setex(cacheKey, CACHE_TTL / 3, JSON.stringify(payload))
						.catch(() => {});
				}

				mergeWideEvent({
					insights_returned: finalInsights.length,
					insights_source: "ai",
				});
				return { success: true, ...payload };
			} catch (error) {
				mergeWideEvent({ insights_error: true });
				useLogger().error(
					error instanceof Error ? error : new Error(String(error)),
					{ insights: { organizationId } }
				);
				return { success: false, insights: [], source: "fallback" };
			}
		},
		{
			body: t.Object({
				organizationId: t.String(),
				timezone: t.Optional(t.String()),
			}),
			idleTimeout: 120_000,
		}
	);
