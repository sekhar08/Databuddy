import type { Page } from "@playwright/test";

/** Standard mock flag response */
export const MOCK_FLAG_ENABLED = {
	enabled: true,
	value: true,
	payload: null,
	reason: "MATCH",
};

export const MOCK_FLAG_DISABLED = {
	enabled: false,
	value: false,
	payload: null,
	reason: "NO_MATCH",
};

export const MOCK_FLAG_VARIANT = {
	enabled: true,
	value: "treatment-a",
	payload: { color: "blue" },
	reason: "MATCH",
	variant: "treatment-a",
};

/**
 * Wait for the SDK bundle to load and expose `window.__SDK__`
 */
export async function waitForSDK(page: Page): Promise<void> {
	await page.waitForFunction(
		() => typeof window.__SDK__ !== "undefined",
		null,
		{
			timeout: 5000,
		}
	);
}

/**
 * Set up standard API route interception for flags endpoints.
 * Returns a callback that resolves with captured request details.
 */
export function setupFlagsRoutes(
	page: Page,
	flagsResponse: Record<string, unknown> = {}
) {
	const requests: { url: string; method: string }[] = [];

	return {
		requests,
		async init() {
			await page.route(
				"**/api.databuddy.cc/public/v1/flags/**",
				async (route) => {
					const url = route.request().url();
					requests.push({ url, method: route.request().method() });

					await route.fulfill({
						status: 200,
						contentType: "application/json",
						body: JSON.stringify({ flags: flagsResponse }),
						headers: { "Access-Control-Allow-Origin": "*" },
					});
				}
			);
		},
	};
}
