import { expect, test } from "@playwright/test";
import { getStressIterations } from "./fuzz-helpers";
import { waitForSDK } from "./test-utils";

test.describe.configure({ mode: "parallel" });

test.describe("Fuzz — BrowserFlagStorage stress + edge cases", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/test");
		await waitForSDK(page);
		await page.evaluate(() => localStorage.clear());
	});

	test("many random set/get cycles stay consistent", async ({ page }) => {
		const iterations = getStressIterations();
		const seed = 99;

		const result = await page.evaluate(
			({ iterations: n, seed: s }) => {
				const failures: string[] = [];

				function mulberry32(a: number) {
					return () => {
						let t = (a += 0x6d_2b_79_f5);
						t = Math.imul(t ^ (t >>> 15), t | 1);
						t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
						return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
					};
				}

				const rand = mulberry32(s);
				const storage = new window.__SDK__.BrowserFlagStorage();
				const base = {
					enabled: true,
					value: true,
					payload: null,
					reason: "MATCH",
				};

				const keys: string[] = [];
				for (let i = 0; i < n; i++) {
					const key = `f-${Math.floor(rand() * 1_000_000)}-${i % 50}`;
					keys.push(key);
					storage.set(key, base);
					const got = storage.get(key);
					if (!got || got.enabled !== true) {
						failures.push(`get mismatch at ${i}`);
					}
				}

				const all = storage.getAll();
				for (const key of keys) {
					if (!all[key]) {
						failures.push(`getAll missing ${key}`);
					}
				}

				return { failures, uniqueKeys: new Set(keys).size };
			},
			{ iterations, seed }
		);

		expect(result.failures, result.failures.join("\n")).toHaveLength(0);
		expect(result.uniqueKeys).toBeGreaterThan(0);
	});

	test("setAll replaces prior keys (repeated random)", async ({ page }) => {
		const rounds = Math.min(30, Math.floor(getStressIterations() / 10));
		const seed = 3;

		const result = await page.evaluate(
			({ rounds: r, seed: s }) => {
				const failures: string[] = [];

				function mulberry32(a: number) {
					return () => {
						let t = (a += 0x6d_2b_79_f5);
						t = Math.imul(t ^ (t >>> 15), t | 1);
						t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
						return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
					};
				}

				const rand = mulberry32(s);
				const storage = new window.__SDK__.BrowserFlagStorage();
				const flag = {
					enabled: false,
					value: false,
					payload: null,
					reason: "NO_MATCH",
				};

				for (let round = 0; round < r; round++) {
					const batch: Record<string, typeof flag> = {};
					const batchSize = 5 + Math.floor(rand() * 20);
					for (let j = 0; j < batchSize; j++) {
						const k = `r${round}-k${j}-${Math.floor(rand() * 10_000)}`;
						batch[k] = flag;
					}
					storage.setAll(batch);
					const all = storage.getAll();
					const count = Object.keys(all).length;
					if (count !== batchSize) {
						failures.push(`round ${round}: expected ${batchSize} keys, got ${count}`);
					}
				}

				return { failures };
			},
			{ rounds, seed }
		);

		expect(result.failures, result.failures.join("\n")).toHaveLength(0);
	});

	test("deleteMultiple + cleanupExpired are safe under churn", async ({
		page,
	}) => {
		const result = await page.evaluate(() => {
			const failures: string[] = [];
			const storage = new window.__SDK__.BrowserFlagStorage();
			const v = {
				enabled: true,
				value: true,
				payload: null,
				reason: "MATCH",
			};

			for (let i = 0; i < 80; i++) {
				storage.set(`c-${i}`, v);
			}
			storage.deleteMultiple(["c-0", "c-1", "c-2"]);
			if (storage.get("c-0")) {
				failures.push("c-0 should be gone");
			}

			localStorage.setItem(
				"db-flag-stale",
				JSON.stringify({
					value: v,
					expiresAt: Date.now() - 10,
				})
			);
			storage.cleanupExpired();
			if (localStorage.getItem("db-flag-stale")) {
				failures.push("stale should be removed");
			}

			return { failures };
		});

		expect(result.failures, result.failures.join("\n")).toHaveLength(0);
	});

	test("string value round-trip in storage wrapper", async ({ page }) => {
		const result = await page.evaluate(() => {
			const failures: string[] = [];
			const storage = new window.__SDK__.BrowserFlagStorage();
			const payload = {
				enabled: true,
				value: "variant-b",
				payload: null,
				reason: "MATCH",
			};
			storage.set("str-val", payload);
			const got = storage.get("str-val");
			if (got?.value !== "variant-b") {
				failures.push("value mismatch");
			}
			return { failures };
		});

		expect(result.failures).toHaveLength(0);
	});
});
