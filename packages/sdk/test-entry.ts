/**
 * Browser entry point for Playwright E2E tests.
 * Bundles the SDK and exposes internals on `window.__SDK__` for test access.
 */

import { BrowserFlagStorage } from "./src/core/flags/browser-storage";
import { CoreFlagsManager } from "./src/core/flags/flags-manager";
import {
	buildQueryParams,
	createCacheEntry,
	DEFAULT_RESULT,
	fetchAllFlags,
	fetchFlag,
	fetchFlags,
	getCacheKey,
	isCacheStale,
	isCacheValid,
	RequestBatcher,
	retryWithBackoff,
} from "./src/core/flags/shared";
import { createScript, isScriptInjected } from "./src/core/script";
import {
	clear,
	flush,
	getAnonymousId,
	getSessionId,
	getTracker,
	getTrackingIds,
	getTrackingParams,
	isTrackerAvailable,
	track,
	trackError,
} from "./src/core/tracker";
import { detectClientId } from "./src/utils";

declare global {
	interface Window {
		__SDK__: typeof sdkExports;
	}
}

const sdkExports = {
	CoreFlagsManager,
	BrowserFlagStorage,
	getCacheKey,
	buildQueryParams,
	DEFAULT_RESULT,
	RequestBatcher,
	createCacheEntry,
	isCacheValid,
	isCacheStale,
	fetchFlag,
	fetchFlags,
	fetchAllFlags,
	retryWithBackoff,
	track,
	clear,
	flush,
	getAnonymousId,
	getSessionId,
	getTrackingIds,
	getTrackingParams,
	isTrackerAvailable,
	getTracker,
	trackError,
	createScript,
	isScriptInjected,
	detectClientId,
};

window.__SDK__ = sdkExports;
