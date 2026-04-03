import { getAutumn } from "@databuddy/rpc";
import { captureError, record } from "@lib/tracing";
import { useLogger } from "evlog/elysia";

type BillingResult = { allowed: true } | { exceeded: true; response: Response };

export function checkAutumnUsage(
	customerId: string,
	featureId: string,
	properties?: Record<string, unknown>
): Promise<BillingResult> {
	return record("checkAutumnUsage", async (): Promise<BillingResult> => {
		const log = useLogger();

		try {
			const response = await record("autumn.check", () =>
				getAutumn().check({
					customerId,
					featureId,
					sendEvent: true,
					properties,
				})
			);
			const b = response.balance;

			if (b) {
				log.set({
					billing: {
						allowed: true,
						usage: b.usage,
						usageLimit: b.granted,
						includedUsage: b.granted,
						unlimited: b.unlimited,
					},
				});
				const usage = b.usage ?? 0;
				const usageLimit = b.granted ?? 0;
				const isUnlimited = b.unlimited ?? false;
				const usageExceeds150Percent =
					!isUnlimited && usageLimit > 0 && usage >= usageLimit * 1.5;

				if (usageExceeds150Percent) {
					log.set({
						billing: { allowed: false, usage, usageLimit, exceeded: true },
					});
					return {
						exceeded: true,
						response: new Response(
							JSON.stringify({
								status: "error",
								message: "Exceeded event limit",
							}),
							{
								status: 429,
								headers: { "Content-Type": "application/json" },
							}
						),
					};
				}
			}

			log.set({ billing: { allowed: true } });
			return { allowed: true };
		} catch (error) {
			log.set({ billing: { allowed: true, checkFailed: true } });
			captureError(error, {
				message: "Autumn check failed, allowing event through",
			});
			return { allowed: true };
		}
	});
}
