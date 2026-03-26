import { expect, test } from "@playwright/test";
import { MOCK_FLAG_ENABLED, waitForSDK } from "./test-utils";

test.describe("BrowserFlagStorage — edge cases", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/test");
		await waitForSDK(page);
		await page.evaluate(() => localStorage.clear());
	});

	test("corrupt JSON in db-flag-* is skipped in getAll", async ({ page }) => {
		await page.evaluate(() => {
			localStorage.setItem("db-flag-bad", "{ not json");
			localStorage.setItem("db-flag-good", "not-json-at-all");
		});

		const result = await page.evaluate(() => {
			const storage = new window.__SDK__.BrowserFlagStorage();
			storage.set("ok", {
				enabled: true,
				value: true,
				payload: null,
				reason: "MATCH",
			});
			return storage.getAll();
		});

		expect(Object.keys(result)).toEqual(["ok"]);
	});

	test("cleanupExpired removes corrupt keys via catch path", async ({
		page,
	}) => {
		await page.evaluate(() => {
			localStorage.setItem("db-flag-garbage", "{{{");
		});

		const stillThere = await page.evaluate(() => {
			const storage = new window.__SDK__.BrowserFlagStorage();
			storage.cleanupExpired();
			return localStorage.getItem("db-flag-garbage");
		});

		expect(stillThere).toBeNull();
	});

	test("setItem quota failure is swallowed (no throw)", async ({ page }) => {
		const result = await page.evaluate(() => {
			const storage = new window.__SDK__.BrowserFlagStorage();
			const original = Storage.prototype.setItem;
			let threw = false;
			Storage.prototype.setItem = function () {
				throw new DOMException("QuotaExceededError", "QuotaExceededError");
			};
			try {
				storage.set("q", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});
			} catch {
				threw = true;
			}
			Storage.prototype.setItem = original;
			return { threw };
		});

		expect(result.threw).toBe(false);
	});

	test("numeric value 0 round-trip (documents value || parsed behavior)", async ({
		page,
	}) => {
		const result = await page.evaluate(() => {
			const storage = new window.__SDK__.BrowserFlagStorage();
			storage.set("zero", {
				enabled: true,
				value: 0,
				payload: null,
				reason: "MATCH",
			});
			const got = storage.get("zero");
			return { value: got?.value, raw: localStorage.getItem("db-flag-zero") };
		});

		expect(result.raw).toBeTruthy();
		expect(result.value).toBe(0);
	});

	test("get returns null when JSON parses but value is expired", async ({
		page,
	}) => {
		const result = await page.evaluate(() => {
			localStorage.setItem(
				"db-flag-exp",
				JSON.stringify({
					value: {
						enabled: true,
						value: true,
						payload: null,
						reason: "MATCH",
					},
					expiresAt: Date.now() - 100,
				})
			);
			const storage = new window.__SDK__.BrowserFlagStorage();
			return storage.get("exp");
		});

		expect(result).toBeNull();
	});

	test("legacy shape without expiresAt still readable from get", async ({
		page,
	}) => {
		const result = await page.evaluate(() => {
			localStorage.setItem(
				"db-flag-legacy",
				JSON.stringify({
					enabled: true,
					value: "legacy",
					payload: null,
					reason: "MATCH",
				})
			);
			const storage = new window.__SDK__.BrowserFlagStorage();
			return storage.get("legacy");
		});

		expect(result).toEqual({
			enabled: true,
			value: "legacy",
			payload: null,
			reason: "MATCH",
		});
	});
});

test.describe("Anonymous id when localStorage is unusable", () => {
	test("CoreFlagsManager works when did cannot be persisted", async ({
		page,
	}) => {
		await page.route("**/api.databuddy.cc/public/v1/flags/**", async (route) => {
			const url = new URL(route.request().url());
			if (url.pathname.includes("/bulk")) {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({
						flags: { x: MOCK_FLAG_ENABLED },
					}),
				});
				return;
			}
			await route.fulfill({ status: 200, body: "{}" });
		});

		await page.goto("/test");
		await waitForSDK(page);

		const result = await page.evaluate(async () => {
			const originalGet = Storage.prototype.getItem;
			const originalSet = Storage.prototype.setItem;
			Storage.prototype.getItem = function () {
				return null;
			};
			Storage.prototype.setItem = function () {
				throw new DOMException("QuotaExceededError", "QuotaExceededError");
			};

			const SDK = window.__SDK__;
			const manager = new SDK.CoreFlagsManager({
				config: { clientId: "anon-fail", autoFetch: false },
			});

			const flag = await manager.getFlag("x");
			manager.destroy();

			Storage.prototype.getItem = originalGet;
			Storage.prototype.setItem = originalSet;

			return { enabled: flag.enabled };
		});

		expect(result.enabled).toBe(true);
	});
});
