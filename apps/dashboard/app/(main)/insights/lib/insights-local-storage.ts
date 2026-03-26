const STORAGE_VERSION = "v1";
const PREFIX = `databuddy.insights.${STORAGE_VERSION}`;

function dismissedStorageKey(organizationId: string): string {
	return `${PREFIX}.dismissed.${organizationId}`;
}

export function loadDismissedIds(organizationId: string): string[] {
	if (typeof window === "undefined") {
		return [];
	}
	try {
		const raw = localStorage.getItem(dismissedStorageKey(organizationId));
		if (!raw) {
			return [];
		}
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}
		return parsed.filter((x): x is string => typeof x === "string");
	} catch {
		return [];
	}
}

export function saveDismissedIds(organizationId: string, ids: string[]): void {
	if (typeof window === "undefined") {
		return;
	}
	localStorage.setItem(
		dismissedStorageKey(organizationId),
		JSON.stringify(ids)
	);
}
