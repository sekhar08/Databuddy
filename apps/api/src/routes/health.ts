import { Elysia } from "elysia";
import { mergeWideEvent } from "../lib/tracing";

export const health = new Elysia().get("/health", function healthCheck() {
	mergeWideEvent({ route: "health", health_check: true });
	return Response.json(
		{ status: "ok" },
		{
			headers: { "Content-Type": "application/json" },
		}
	);
});
