import { tool } from "ai";
import { z } from "zod";
import { getWebsiteDomain } from "../../lib/website-utils";
import { executeQuery } from "../../query";
import type { QueryRequest } from "../../query/types";
import { createToolLogger } from "./utils/logger";

const logger = createToolLogger("Profiles");

function daysAgo(d: number): string {
	const date = new Date();
	date.setDate(date.getDate() - d);
	return date.toISOString().split("T").at(0) ?? "";
}

function today(): string {
	return new Date().toISOString().split("T").at(0) ?? "";
}

export function createProfileTools() {
	const listProfilesTool = tool({
		description:
			"List visitor profiles for a website. Returns recent visitors with their session counts, page views, device info, country, browser, and referrer. Use this when the user asks about visitors, users, or audience segments.",
		inputSchema: z.object({
			websiteId: z.string().describe("The website ID"),
			days: z
				.number()
				.min(1)
				.max(90)
				.default(7)
				.describe("Number of days to look back"),
			limit: z
				.number()
				.min(1)
				.max(50)
				.default(10)
				.describe("Max number of profiles"),
			filters: z
				.array(
					z.object({
						field: z.string(),
						op: z.enum([
							"eq",
							"ne",
							"contains",
							"not_contains",
							"starts_with",
							"in",
							"not_in",
						]),
						value: z.union([z.string(), z.number()]),
					})
				)
				.optional()
				.describe(
					"Filters to narrow results (e.g. country, browser_name, device_type, referrer)"
				),
			websiteDomain: z.string().optional(),
		}),
		execute: async ({ websiteId, days, limit, filters, websiteDomain }) => {
			try {
				const domain = websiteDomain ?? (await getWebsiteDomain(websiteId));
				const from = daysAgo(days);
				const to = today();

				const req: QueryRequest = {
					projectId: websiteId,
					type: "profile_list",
					from,
					to,
					limit,
					filters,
					timezone: "UTC",
				};

				const data = await executeQuery(req, domain, "UTC");

				logger.info("Listed profiles", {
					websiteId,
					days,
					resultCount: data.length,
				});

				return {
					profiles: data,
					count: data.length,
					period: `Last ${days} days`,
				};
			} catch (error) {
				logger.error("Failed to list profiles", {
					websiteId,
					error: error instanceof Error ? error.message : "Unknown error",
				});
				throw error instanceof Error
					? error
					: new Error("Failed to list visitor profiles.");
			}
		},
	});

	const getProfileTool = tool({
		description:
			"Get detailed information about a specific visitor by their anonymous ID. Returns first/last visit, total sessions, pageviews, duration, device, browser, OS, and location.",
		inputSchema: z.object({
			websiteId: z.string().describe("The website ID"),
			visitorId: z
				.string()
				.describe("The visitor's anonymous_id (from list_profiles)"),
			days: z
				.number()
				.min(1)
				.max(365)
				.default(30)
				.describe("Number of days to look back"),
			websiteDomain: z.string().optional(),
		}),
		execute: async ({ websiteId, visitorId, days, websiteDomain }) => {
			try {
				const domain = websiteDomain ?? (await getWebsiteDomain(websiteId));
				const from = daysAgo(days);
				const to = today();

				const req: QueryRequest = {
					projectId: websiteId,
					type: "profile_detail",
					from,
					to,
					filters: [{ field: "anonymous_id", op: "eq", value: visitorId }],
					timezone: "UTC",
				};

				const data = await executeQuery(req, domain, "UTC");

				if (data.length === 0) {
					return {
						profile: null,
						message: `No data found for visitor ${visitorId} in the last ${days} days.`,
					};
				}

				logger.info("Fetched profile detail", { websiteId, visitorId });

				return {
					profile: data.at(0),
					period: `Last ${days} days`,
				};
			} catch (error) {
				logger.error("Failed to get profile", {
					websiteId,
					visitorId,
					error: error instanceof Error ? error.message : "Unknown error",
				});
				throw error instanceof Error
					? error
					: new Error("Failed to get visitor profile.");
			}
		},
	});

	const getProfileSessionsTool = tool({
		description:
			"Get session history for a specific visitor. Returns each session with its start/end time, duration, page views, pages visited, device, browser, and location. Use this after list_profiles or get_profile to drill into a visitor's behavior.",
		inputSchema: z.object({
			websiteId: z.string().describe("The website ID"),
			visitorId: z
				.string()
				.describe("The visitor's anonymous_id (from list_profiles)"),
			days: z
				.number()
				.min(1)
				.max(365)
				.default(30)
				.describe("Number of days to look back"),
			limit: z
				.number()
				.min(1)
				.max(100)
				.default(20)
				.describe("Max number of sessions to return"),
			websiteDomain: z.string().optional(),
		}),
		execute: async ({ websiteId, visitorId, days, limit, websiteDomain }) => {
			try {
				const domain = websiteDomain ?? (await getWebsiteDomain(websiteId));
				const from = daysAgo(days);
				const to = today();

				const req: QueryRequest = {
					projectId: websiteId,
					type: "profile_sessions",
					from,
					to,
					limit,
					filters: [{ field: "anonymous_id", op: "eq", value: visitorId }],
					timezone: "UTC",
				};

				const data = await executeQuery(req, domain, "UTC");

				logger.info("Fetched profile sessions", {
					websiteId,
					visitorId,
					sessionCount: data.length,
				});

				return {
					sessions: data,
					count: data.length,
					period: `Last ${days} days`,
				};
			} catch (error) {
				logger.error("Failed to get profile sessions", {
					websiteId,
					visitorId,
					error: error instanceof Error ? error.message : "Unknown error",
				});
				throw error instanceof Error
					? error
					: new Error("Failed to get visitor sessions.");
			}
		},
	});

	return {
		list_profiles: listProfilesTool,
		get_profile: getProfileTool,
		get_profile_sessions: getProfileSessionsTool,
	} as const;
}
