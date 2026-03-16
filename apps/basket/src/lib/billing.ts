import { captureError, record, setAttributes } from "@lib/tracing";
import { Autumn as autumn } from "autumn-js";

type BillingResult = { allowed: true } | { exceeded: true; response: Response };

export function checkAutumnUsage(
	customerId: string,
	featureId: string,
	properties?: Record<string, unknown>
): Promise<BillingResult> {
	return record("checkAutumnUsage", async (): Promise<BillingResult> => {
		try {
			const result = await record("autumn.check", () =>
				autumn.check({
					customer_id: customerId,
					feature_id: featureId,
					send_event: true,
					// @ts-expect-error autumn types are not up to date
					properties,
				})
			);
			const data = result.data;

			if (data) {
				const usage = data.usage ?? 0;
				const usageLimit = data.usage_limit ?? data.included_usage ?? 0;
				const isUnlimited = data.unlimited ?? false;
				const usageExceeds150Percent =
					!isUnlimited && usageLimit > 0 && usage >= usageLimit * 1.5;

				if (usageExceeds150Percent) {
					setAttributes({
						validation_failed: true,
						validation_reason: "exceeded_event_limit",
						autumn_allowed: false,
						usage_exceeded_150_percent: true,
						usage,
						usage_limit: usageLimit,
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

			setAttributes({
				autumn_allowed: data?.allowed ?? false,
				autumn_overage_allowed: data?.overage_allowed ?? false,
			});

			return { allowed: true };
		} catch (error) {
			captureError(error, {
				message: "Autumn check failed, allowing event through",
			});
			setAttributes({
				autumn_check_failed: true,
			});
			return { allowed: true };
		}
	});
}
