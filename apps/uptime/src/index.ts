import { Receiver } from "@upstash/qstash";
import { Elysia } from "elysia";
import { initLogger, log } from "evlog";
import { evlog } from "evlog/elysia";
import { z } from "zod";
import { type CheckOptions, checkUptime, lookupSchedule } from "./actions";
import type { JsonParsingConfig } from "./json-parser";
import {
	enrichUptimeWideEvent,
	flushBatchedUptimeDrain,
	uptimeLoggerDrain,
} from "./lib/evlog-uptime";
import { sendUptimeEvent } from "./lib/producer";
import { captureError, mergeWideEvent } from "./lib/tracing";
import {
	getPreviousMonitorStatus,
	sendUptimeTransitionEmailsIfNeeded,
} from "./uptime-transition-emails";

initLogger({
	env: { service: "uptime" },
	drain: uptimeLoggerDrain,
	sampling: {
		// rates: { info: 20, warn: 50, debug: 5 },
		// keep: [{ status: 400 }, { duration: 1500 }],
	},
});

process.on("unhandledRejection", (reason, _promise) => {
	captureError(reason, { type: "unhandledRejection" });
	log.error({
		process: "unhandledRejection",
		reason: reason instanceof Error ? reason.message : String(reason),
	});
});

process.on("uncaughtException", (error) => {
	captureError(error, { type: "uncaughtException" });
	log.error({
		process: "uncaughtException",
		error: error instanceof Error ? error.message : String(error),
	});
});

process.on("SIGTERM", async () => {
	log.info("lifecycle", "SIGTERM received, shutting down gracefully");
	await flushBatchedUptimeDrain().catch((error) =>
		log.error({
			lifecycle: "drainFlush",
			error: error instanceof Error ? error.message : String(error),
		})
	);
	process.exit(0);
});

process.on("SIGINT", async () => {
	log.info("lifecycle", "SIGINT received, shutting down gracefully");
	await flushBatchedUptimeDrain().catch((error) =>
		log.error({
			lifecycle: "drainFlush",
			error: error instanceof Error ? error.message : String(error),
		})
	);
	process.exit(0);
});

const CURRENT_SIGNING_KEY = process.env.QSTASH_CURRENT_SIGNING_KEY;
const NEXT_SIGNING_KEY = process.env.QSTASH_NEXT_SIGNING_KEY;

if (!(CURRENT_SIGNING_KEY && NEXT_SIGNING_KEY)) {
	throw new Error(
		"QSTASH_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY environment variables are required"
	);
}

const receiver = new Receiver({
	currentSigningKey: CURRENT_SIGNING_KEY,
	nextSigningKey: NEXT_SIGNING_KEY,
});

const app = new Elysia()
	.use(
		evlog({
			enrich: enrichUptimeWideEvent,
		})
	)
	.onError(function handleError({ error, code }) {
		captureError(error, { type: "elysia_error", code });
	})
	.get("/health", () => ({ status: "ok" }))
	.post("/", async ({ headers, body }) => {
		try {
			const headerSchema = z.object({
				"upstash-signature": z.string(),
				"x-schedule-id": z.string(),
				"upstash-retried": z.string().optional(),
			});

			const parsed = headerSchema.safeParse(headers);
			if (!parsed.success) {
				const errorDetails = parsed.error.format();
				captureError(new Error("Missing required headers"), {
					type: "validation_error",
					scheduleId: headers["x-schedule-id"] as string,
				});
				return new Response(
					JSON.stringify({
						error: "Missing required headers",
						details: errorDetails,
					}),
					{
						status: 400,
						headers: { "Content-Type": "application/json" },
					}
				);
			}

			const { "upstash-signature": signature, "x-schedule-id": scheduleId } =
				parsed.data;

			const isValid = await receiver.verify({
				// @ts-expect-error, this doesn't require type assertions
				body,
				signature,
				url: process.env.UPTIME_URL,
			});

			if (!isValid) {
				captureError(new Error("Invalid QStash signature"), {
					type: "auth_error",
					scheduleId,
				});
				return new Response("Invalid signature", { status: 401 });
			}

			const schedule = await lookupSchedule(scheduleId);
			if (!schedule.success) {
				captureError(new Error(schedule.error), {
					type: "schedule_not_found",
					scheduleId,
				});
				return new Response(
					JSON.stringify({
						error: "Schedule not found",
						scheduleId,
						details: schedule.error,
					}),
					{
						status: 404,
						headers: { "Content-Type": "application/json" },
					}
				);
			}

			const monitorId = schedule.data.websiteId || scheduleId;

			mergeWideEvent({
				schedule_id: scheduleId,
				monitor_id: monitorId,
				organization_id: schedule.data.organizationId,
				...(schedule.data.websiteId
					? { website_id: schedule.data.websiteId }
					: {}),
			});

			const maxRetries = parsed.data["upstash-retried"]
				? Number.parseInt(parsed.data["upstash-retried"], 10) + 3
				: 3;

			const options: CheckOptions = {
				timeout: schedule.data.timeout ?? undefined,
				cacheBust: schedule.data.cacheBust,
				jsonParsingConfig: schedule.data
					.jsonParsingConfig as JsonParsingConfig | null,
			};

			const result = await checkUptime(
				monitorId,
				schedule.data.url,
				1,
				maxRetries,
				options
			);

			if (!result.success) {
				captureError(new Error(result.error), {
					type: "uptime_check_failed",
					monitorId,
					url: schedule.data.url,
				});
				return new Response("Failed to check uptime", { status: 500 });
			}

			const previousStatus = await getPreviousMonitorStatus(monitorId);

			mergeWideEvent({
				previous_uptime_status:
					previousStatus === undefined ? -1 : previousStatus,
			});

			try {
				await sendUptimeEvent(result.data, monitorId);
				await sendUptimeTransitionEmailsIfNeeded({
					schedule: schedule.data,
					data: result.data,
					previousStatus,
				});
			} catch (error) {
				captureError(error, {
					type: "producer_error",
					monitorId,
					httpCode: result.data.http_code,
				});
			}

			return new Response("Uptime check complete", { status: 200 });
		} catch (error) {
			captureError(error, { type: "unexpected_error" });
			return new Response("Internal server error", { status: 500 });
		}
	});

export default {
	port: 4000,
	fetch: app.fetch,
};
