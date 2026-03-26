import { expect, test } from "@playwright/test";
import {
	MOCK_FLAG_DISABLED,
	MOCK_FLAG_ENABLED,
	waitForSDK,
} from "./test-utils";

function bulkOnlyRoute(
	page: import("@playwright/test").Page,
	handler: (requestedKeys: string[]) => Record<string, typeof MOCK_FLAG_ENABLED>
) {
	return page.route("**/api.databuddy.cc/public/v1/flags/**", async (route) => {
		const url = new URL(route.request().url());
		const keysParam = url.searchParams.get("keys");

		if (url.pathname.includes("/bulk")) {
			const requestedKeys = keysParam?.split(",").filter(Boolean) ?? [];
			const flags = handler(requestedKeys);
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ flags }),
			});
			return;
		}

		if (url.pathname.includes("/evaluate")) {
			const key = url.searchParams.get("key") ?? "";
			const flags = handler([key]);
			const one = flags[key] ?? MOCK_FLAG_DISABLED;
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(one),
			});
			return;
		}

		await route.fulfill({
			status: 404,
			body: "not found",
		});
	});
}

test.describe("CoreFlagsManager — edge cases", () => {
	test("callbacks: onReady, onFlagsUpdate, onConfigUpdate", async ({ page }) => {
		let bulkHits = 0;
		await bulkOnlyRoute(page, (keys) => {
			bulkHits++;
			return Object.fromEntries(
				keys.map((k) => [k, MOCK_FLAG_ENABLED])
			);
		});

		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const events: string[] = [];
			const SDK = window.__SDK__;

			const manager = new SDK.CoreFlagsManager({
				config: { clientId: "cb-test", autoFetch: true },
				onReady: () => {
					events.push("ready");
				},
				onFlagsUpdate: () => {
					events.push("flags");
				},
				onConfigUpdate: () => {
					events.push("config");
				},
			});

			await new Promise((r) => setTimeout(r, 300));
			manager.updateConfig({
				clientId: "cb-test",
				environment: "staging",
			});
			await new Promise((r) => setTimeout(r, 100));
			manager.destroy();

			return { events };
		});

		expect(result.events).toContain("ready");
		expect(result.events).toContain("flags");
		expect(result.events).toContain("config");
		expect(bulkHits).toBeGreaterThanOrEqual(1);
	});

	test("skipStorage: does not hydrate cache from BrowserFlagStorage", async ({
		page,
	}) => {
		await bulkOnlyRoute(page, () => ({
			"remote-only": MOCK_FLAG_ENABLED,
		}));

		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const SDK = window.__SDK__;
			const storage = new SDK.BrowserFlagStorage();
			storage.set("preseed", {
				enabled: true,
				value: true,
				payload: null,
				reason: "MATCH",
			});

			const manager = new SDK.CoreFlagsManager({
				config: { clientId: "skip-test", autoFetch: false, skipStorage: true },
				storage,
			});

			await new Promise((r) => setTimeout(r, 50));
			const beforeFetch = Object.keys(manager.getMemoryFlags()).length;

			await manager.fetchAllFlags();
			const after = manager.getMemoryFlags();

			manager.destroy();
			return { beforeFetch, hasRemoteOnly: "remote-only" in after };
		});

		expect(result.beforeFetch).toBe(0);
		expect(result.hasRemoteOnly).toBe(true);
	});

	test("getFlag(key, user): per-call user affects cache key; bulk request uses config user", async ({
		page,
	}) => {
		await bulkOnlyRoute(page, (keys) =>
			Object.fromEntries(keys.map((k) => [k, MOCK_FLAG_ENABLED]))
		);

		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const SDK = window.__SDK__;
			const kA = SDK.getCacheKey("shared-flag", { userId: "user-a" });
			const kB = SDK.getCacheKey("shared-flag", { userId: "user-b" });
			const manager = new SDK.CoreFlagsManager({
				config: {
					clientId: "u-test",
					autoFetch: false,
					user: { userId: "api-user" },
				},
			});

			await manager.getFlag("shared-flag", { userId: "user-a" });
			await manager.getFlag("shared-flag", { userId: "user-b" });
			const mem = manager.getMemoryFlags();

			manager.destroy();
			return {
				cacheKeysDiffer: kA !== kB,
				memoryKeys: Object.keys(mem),
			};
		});

		expect(result.cacheKeysDiffer).toBe(true);
		expect(result.memoryKeys).toContain("shared-flag");
	});

	test("in-flight dedup: parallel getFlag same key issues one bulk request", async ({
		page,
	}) => {
		let bulkCount = 0;
		await page.route("**/api.databuddy.cc/public/v1/flags/**", async (route) => {
			const url = new URL(route.request().url());
			if (url.pathname.includes("/bulk")) {
				bulkCount++;
				const keysParam = url.searchParams.get("keys") ?? "";
				const keys = keysParam.split(",").filter(Boolean);
				const flags = Object.fromEntries(
					keys.map((k) => [k, MOCK_FLAG_ENABLED])
				);
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ flags }),
				});
				return;
			}
			await route.fulfill({ status: 200, body: "{}" });
		});

		await page.goto("/test");
		await waitForSDK(page);

		await page.evaluate(async () => {
			const SDK = window.__SDK__;
			const manager = new SDK.CoreFlagsManager({
				config: { clientId: "dedup-test", autoFetch: false },
			});

			await Promise.all([
				manager.getFlag("same-key"),
				manager.getFlag("same-key"),
				manager.getFlag("same-key"),
			]);

			manager.destroy();
		});

		expect(bulkCount).toBe(1);
	});

	test("getMemoryFlags: colon in flag keys — last wins for same first segment", async ({
		page,
	}) => {
		await bulkOnlyRoute(page, (keys) => {
			const out: Record<string, typeof MOCK_FLAG_ENABLED> = {};
			for (const k of keys) {
				if (k === "x:y") {
					out[k] = MOCK_FLAG_ENABLED;
				} else if (k === "x:z") {
					out[k] = MOCK_FLAG_DISABLED;
				} else {
					out[k] = MOCK_FLAG_ENABLED;
				}
			}
			return out;
		});

		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const SDK = window.__SDK__;
			const manager = new SDK.CoreFlagsManager({
				config: { clientId: "colon-test", autoFetch: false },
			});

			await manager.getFlag("x:y");
			await manager.getFlag("x:z");
			const mem = manager.getMemoryFlags();

			manager.destroy();
			return { keys: Object.keys(mem), x: mem.x };
		});

		expect(result.keys).toContain("x");
		expect(result.x?.enabled).toBe(false);
	});

	test("fetchAllFlags with empty flags removes prior cache entries", async ({
		page,
	}) => {
		let call = 0;
		await page.route("**/api.databuddy.cc/public/v1/flags/**", async (route) => {
			const url = new URL(route.request().url());
			if (!url.pathname.includes("/bulk")) {
				await route.fulfill({ status: 200, body: "{}" });
				return;
			}
			call++;
			const body =
				call === 1
					? JSON.stringify({
						flags: { keepMe: MOCK_FLAG_ENABLED },
					})
					: JSON.stringify({ flags: {} });

			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body,
			});
		});

		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const SDK = window.__SDK__;
			const manager = new SDK.CoreFlagsManager({
				config: { clientId: "empty-bulk", autoFetch: false },
			});

			await manager.fetchAllFlags();
			const afterFirst = Object.keys(manager.getMemoryFlags());

			await manager.fetchAllFlags();
			const afterSecond = Object.keys(manager.getMemoryFlags());

			manager.destroy();
			return { afterFirst, afterSecond };
		});

		expect(result.afterFirst).toContain("keepMe");
		expect(result.afterSecond).not.toContain("keepMe");
	});

	test("isEnabled surfaces error status when result.reason is ERROR", async ({
		page,
	}) => {
		await page.route("**/api.databuddy.cc/public/v1/flags/**", async (route) => {
			const url = new URL(route.request().url());
			if (url.pathname.includes("/bulk")) {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						flags: {
							errFlag: {
								enabled: false,
								value: false,
								payload: null,
								reason: "ERROR",
							},
						},
					}),
				});
				return;
			}
			await route.fulfill({ status: 200, body: "{}" });
		});

		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const SDK = window.__SDK__;
			const manager = new SDK.CoreFlagsManager({
				config: { clientId: "err-status", autoFetch: false },
			});

			await manager.getFlag("errFlag");
			const state = manager.isEnabled("errFlag");

			manager.destroy();
			return { status: state.status };
		});

		expect(result.status).toBe("error");
	});

	test("visibility: skips fetchAllFlags when hidden and cache non-empty", async ({
		page,
	}) => {
		let bulkCount = 0;
		await page.route("**/api.databuddy.cc/public/v1/flags/**", async (route) => {
			const url = new URL(route.request().url());
			if (url.pathname.includes("/bulk")) {
				bulkCount++;
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						flags: { warm: MOCK_FLAG_ENABLED },
					}),
				});
				return;
			}
			await route.fulfill({ status: 200, body: "{}" });
		});

		await page.goto("/test");
		await waitForSDK(page);

		await page.evaluate(async () => {
			const SDK = window.__SDK__;
			const manager = new SDK.CoreFlagsManager({
				config: { clientId: "vis-test", autoFetch: false },
			});
			await manager.fetchAllFlags();
			(window as unknown as { __tm: typeof manager }).__tm = manager;
		});

		expect(bulkCount).toBe(1);

		await page.evaluate(() => {
			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				get: () => "hidden",
			});
			document.dispatchEvent(new Event("visibilitychange"));
		});

		await page.evaluate(async () => {
			const w = window as unknown as { __tm: { fetchAllFlags: () => Promise<void> } };
			await w.__tm.fetchAllFlags();
		});

		expect(bulkCount).toBe(1);

		await page.evaluate(() => {
			Object.defineProperty(document, "visibilityState", {
				configurable: true,
				get: () => "visible",
			});
			document.dispatchEvent(new Event("visibilitychange"));
		});

		await page.evaluate(async () => {
			const w = window as unknown as { __tm: { fetchAllFlags: () => Promise<void> } };
			await w.__tm.fetchAllFlags();
		});

		expect(bulkCount).toBe(2);

		await page.evaluate(() => {
			const w = window as unknown as { __tm: { destroy: () => void } };
			w.__tm.destroy();
			delete (window as unknown as { __tm?: unknown }).__tm;
		});
	});

	test("getFlag rejects when bulk fetch network fails", async ({ page }) => {
		await page.route("**/api.databuddy.cc/public/v1/flags/**", async (route) => {
			await route.abort("failed");
		});

		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const SDK = window.__SDK__;
			const manager = new SDK.CoreFlagsManager({
				config: { clientId: "net-fail", autoFetch: false },
			});

			let rejected = false;
			try {
				await manager.getFlag("any");
			} catch {
				rejected = true;
			}

			manager.destroy();
			return { rejected };
		});

		expect(result.rejected).toBe(true);
	});

	test("fetchFlag returns ERROR shape on non-OK response", async ({ page }) => {
		await page.route("**/api.databuddy.cc/public/v1/flags/**", async (route) => {
			await route.fulfill({ status: 500, body: "err" });
		});

		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const SDK = window.__SDK__;
			const params = new URLSearchParams();
			params.set("clientId", "c1");
			const r = await SDK.fetchFlag(
				"https://api.databuddy.cc",
				"my-key",
				params
			);
			return { reason: r.reason, enabled: r.enabled };
		});

		expect(result.reason).toBe("ERROR");
		expect(result.enabled).toBe(false);
	});

	test("retryWithBackoff succeeds after transient failures", async ({ page }) => {
		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const SDK = window.__SDK__;
			let n = 0;
			const value = await SDK.retryWithBackoff(
				async () => {
					n++;
					if (n < 3) {
						throw new Error("fail");
					}
					return "ok";
				},
				5,
				1
			);
			return { value, attempts: n };
		});

		expect(result.value).toBe("ok");
		expect(result.attempts).toBe(3);
	});
});
