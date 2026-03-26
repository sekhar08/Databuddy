import { expect, test } from "@playwright/test";
import { waitForSDK } from "./test-utils";

test.describe("BrowserFlagStorage", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/test");
		await waitForSDK(page);
		await page.evaluate(() => localStorage.clear());
	});

	test.describe("set and get", () => {
		test("stores and retrieves a flag value", async ({ page }) => {
			const result = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("my-flag", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});
				return storage.get("my-flag");
			});

			expect(result).toEqual({
				enabled: true,
				value: true,
				payload: null,
				reason: "MATCH",
			});
		});

		test("returns null for non-existent key", async ({ page }) => {
			const result = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				return storage.get("does-not-exist");
			});

			expect(result).toBeNull();
		});

		test("stores with db-flag- prefix in localStorage", async ({ page }) => {
			const exists = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("test-key", {
					enabled: true,
					value: "hello",
					payload: null,
					reason: "MATCH",
				});
				return localStorage.getItem("db-flag-test-key") !== null;
			});

			expect(exists).toBe(true);
		});

		test("stored entries have TTL metadata", async ({ page }) => {
			const data = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("ttl-test", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});
				const raw = localStorage.getItem("db-flag-ttl-test");
				return raw ? JSON.parse(raw) : null;
			});

			expect(data).toBeTruthy();
			expect(data.expiresAt).toBeGreaterThan(Date.now());
			expect(data.timestamp).toBeLessThanOrEqual(Date.now());
		});
	});

	test.describe("TTL expiration", () => {
		test("returns null for expired entries", async ({ page }) => {
			const result = await page.evaluate(() => {
				localStorage.setItem(
					"db-flag-expired",
					JSON.stringify({
						value: {
							enabled: true,
							value: true,
							payload: null,
							reason: "MATCH",
						},
						timestamp: Date.now() - 100_000,
						expiresAt: Date.now() - 1,
					})
				);

				const storage = new window.__SDK__.BrowserFlagStorage();
				return storage.get("expired");
			});

			expect(result).toBeNull();
		});

		test("removes expired entries from localStorage on get", async ({
			page,
		}) => {
			const exists = await page.evaluate(() => {
				localStorage.setItem(
					"db-flag-to-expire",
					JSON.stringify({
						value: {
							enabled: true,
							value: true,
							payload: null,
							reason: "MATCH",
						},
						expiresAt: Date.now() - 1,
					})
				);

				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.get("to-expire");
				return localStorage.getItem("db-flag-to-expire");
			});

			expect(exists).toBeNull();
		});
	});

	test.describe("getAll", () => {
		test("returns all stored flags", async ({ page }) => {
			const result = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("flag-a", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});
				storage.set("flag-b", {
					enabled: false,
					value: false,
					payload: null,
					reason: "NO_MATCH",
				});
				return storage.getAll();
			});

			expect(result["flag-a"]).toBeDefined();
			expect(result["flag-a"].enabled).toBe(true);
			expect(result["flag-b"]).toBeDefined();
			expect(result["flag-b"].enabled).toBe(false);
		});

		test("excludes expired entries from getAll", async ({ page }) => {
			const result = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("valid-flag", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});

				localStorage.setItem(
					"db-flag-expired-flag",
					JSON.stringify({
						value: {
							enabled: true,
							value: true,
							payload: null,
							reason: "MATCH",
						},
						expiresAt: Date.now() - 1,
					})
				);

				return storage.getAll();
			});

			expect(result["valid-flag"]).toBeDefined();
			expect(result["expired-flag"]).toBeUndefined();
		});

		test("only returns entries with db-flag- prefix", async ({ page }) => {
			const result = await page.evaluate(() => {
				localStorage.setItem("other-key", "should-not-appear");
				localStorage.setItem("did", "anon-id");

				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("real-flag", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});

				const all = storage.getAll();
				return {
					keys: Object.keys(all),
					hasRealFlag: "real-flag" in all,
				};
			});

			expect(result.hasRealFlag).toBe(true);
			expect(result.keys).not.toContain("other-key");
			expect(result.keys).not.toContain("did");
		});
	});

	test.describe("setAll", () => {
		test("sets all flags and removes old ones", async ({ page }) => {
			const result = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("old-flag", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});

				storage.setAll({
					"new-flag-a": {
						enabled: true,
						value: true,
						payload: null,
						reason: "MATCH",
					},
					"new-flag-b": {
						enabled: false,
						value: false,
						payload: null,
						reason: "NO_MATCH",
					},
				});

				return storage.getAll();
			});

			expect(result["new-flag-a"]).toBeDefined();
			expect(result["new-flag-b"]).toBeDefined();
			expect(result["old-flag"]).toBeUndefined();
		});
	});

	test.describe("clear", () => {
		test("removes all flag entries", async ({ page }) => {
			const result = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("flag-1", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});
				storage.set("flag-2", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});

				localStorage.setItem("non-flag-key", "preserved");

				storage.clear();

				return {
					flags: storage.getAll(),
					nonFlagKey: localStorage.getItem("non-flag-key"),
				};
			});

			expect(Object.keys(result.flags)).toHaveLength(0);
			expect(result.nonFlagKey).toBe("preserved");
		});
	});

	test.describe("delete", () => {
		test("removes a single flag", async ({ page }) => {
			const result = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("keep", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});
				storage.set("remove", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});

				storage.delete("remove");
				return storage.getAll();
			});

			expect(result["keep"]).toBeDefined();
			expect(result["remove"]).toBeUndefined();
		});

		test("deleteMultiple removes multiple flags", async ({ page }) => {
			const result = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("a", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});
				storage.set("b", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});
				storage.set("c", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});

				storage.deleteMultiple(["a", "b"]);
				return storage.getAll();
			});

			expect(result["a"]).toBeUndefined();
			expect(result["b"]).toBeUndefined();
			expect(result["c"]).toBeDefined();
		});
	});

	test.describe("cleanupExpired", () => {
		test("removes only expired entries", async ({ page }) => {
			const result = await page.evaluate(() => {
				const storage = new window.__SDK__.BrowserFlagStorage();
				storage.set("valid", {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				});

				localStorage.setItem(
					"db-flag-expired-1",
					JSON.stringify({
						value: {
							enabled: true,
							value: true,
							payload: null,
							reason: "MATCH",
						},
						expiresAt: Date.now() - 1000,
					})
				);
				localStorage.setItem(
					"db-flag-expired-2",
					JSON.stringify({
						value: {
							enabled: true,
							value: true,
							payload: null,
							reason: "MATCH",
						},
						expiresAt: Date.now() - 500,
					})
				);

				storage.cleanupExpired();

				return {
					all: storage.getAll(),
					expired1: localStorage.getItem("db-flag-expired-1"),
					expired2: localStorage.getItem("db-flag-expired-2"),
				};
			});

			expect(result.all["valid"]).toBeDefined();
			expect(result.expired1).toBeNull();
			expect(result.expired2).toBeNull();
		});
	});
});
