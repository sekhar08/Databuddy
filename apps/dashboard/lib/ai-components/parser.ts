import { hasComponent } from "./registry";
import { validateComponentJSON } from "./schemas";
import type {
	ContentSegment,
	ParsedSegments,
	RawComponentInput,
} from "./types";

const COMPONENT_START = '{"type":"';

/**
 * Type guard to validate raw component input structure.
 * Uses Zod schemas to validate data shape beyond just checking the type exists.
 */
function isRawComponentInput(obj: unknown): obj is RawComponentInput {
	if (typeof obj !== "object" || obj === null) {
		return false;
	}
	const record = obj as Record<string, unknown>;
	if (typeof record.type !== "string" || !hasComponent(record.type)) {
		return false;
	}
	const { valid } = validateComponentJSON(obj);
	return valid;
}

/**
 * Attempt to close all open JSON structures in a truncated string.
 * Returns a parseable JSON string, or null if the input is too incomplete.
 */
export function repairPartialJSON(input: string): string | null {
	if (input.length < 10) return null;

	let result = input;
	// Remove trailing comma before we close structures
	result = result.replace(/,\s*$/, "");

	// Track open structures
	let inString = false;
	let escaped = false;
	const stack: string[] = [];

	for (let i = 0; i < result.length; i++) {
		const ch = result[i];

		if (escaped) {
			escaped = false;
			continue;
		}

		if (ch === "\\") {
			escaped = true;
			continue;
		}

		if (ch === '"') {
			if (inString) {
				inString = false;
			} else {
				inString = true;
			}
			continue;
		}

		if (inString) continue;

		if (ch === "{") stack.push("}");
		else if (ch === "[") stack.push("]");
		else if (ch === "}" || ch === "]") stack.pop();
	}

	// Close unclosed string
	if (inString) {
		result += '"';
	}

	// Drop incomplete key-value pair at the end of an object
	// e.g. {"type":"line-chart","tit  ->  {"type":"line-chart"
	// After closing the string, check if the last token is a dangling key
	const lastBrace = result.lastIndexOf("{");
	if (stack.length > 0 && stack[stack.length - 1] === "}") {
		// Only clean dangling KV in the current object level
		const afterLastBrace = result.substring(lastBrace);
		// Check for incomplete value after colon
		if (/,\s*"[^"]*"\s*$/.test(afterLastBrace) || /,\s*"[^"]*"\s*:\s*$/.test(afterLastBrace)) {
			result = result.replace(/,\s*"[^"]*"(\s*:\s*[^,}\]]*?)?\s*$/, "");
		}
	}

	// Remove trailing commas again (may have been exposed by string closing)
	result = result.replace(/,\s*$/, "");

	// Close all open structures in reverse order
	while (stack.length > 0) {
		result += stack.pop();
	}

	// Validate the repair produced valid JSON
	try {
		JSON.parse(result);
		return result;
	} catch {
		return null;
	}
}

/**
 * Parse content into ordered segments of text and components.
 * Components are rendered in the order they appear in the content.
 */
export function parseContentSegments(content: string): ParsedSegments {
	const segments: ContentSegment[] = [];
	let searchIndex = 0;

	while (searchIndex < content.length) {
		const startIndex = content.indexOf(COMPONENT_START, searchIndex);

		if (startIndex === -1) {
			// No more components, add remaining text
			const remainingText = content.substring(searchIndex).trim();
			if (remainingText) {
				segments.push({ type: "text", content: remainingText });
			}
			break;
		}

		// Add text before the component
		const textBefore = content.substring(searchIndex, startIndex).trim();
		if (textBefore) {
			segments.push({ type: "text", content: textBefore });
		}

		// Find matching closing brace
		let braceCount = 0;
		let endIndex = -1;
		for (let i = startIndex; i < content.length; i++) {
			if (content.at(i) === "{") {
				braceCount++;
			} else if (content.at(i) === "}") {
				braceCount--;
				if (braceCount === 0) {
					endIndex = i;
					break;
				}
			}
		}

		if (endIndex === -1) {
			// JSON is still streaming. The text before the JSON was already
			// pushed as a segment above (line 129-131). Just attempt repair
			// on the partial JSON — never show raw JSON to the user.
			const partialJson = content.substring(startIndex);
			const repaired = repairPartialJSON(partialJson);

			if (repaired) {
				try {
					const parsed = JSON.parse(repaired) as unknown;
					const record = parsed as Record<string, unknown>;
					if (
						typeof record.type === "string" &&
						hasComponent(record.type)
					) {
						segments.push({
							type: "streaming-component",
							content: record as RawComponentInput,
						});
					}
					// If type is unknown, the partial JSON is silently hidden
					// (no text segment for raw JSON). It will render once complete.
				} catch {
					// Repair produced invalid JSON — still hidden from text
				}
			}
			// If repair failed entirely, the partial JSON is still hidden.
			// The user sees only the text before it.
			break;
		}

		const jsonString = content.substring(startIndex, endIndex + 1);
		try {
			const parsed = JSON.parse(jsonString) as unknown;
			if (isRawComponentInput(parsed)) {
				segments.push({ type: "component", content: parsed });
				searchIndex = endIndex + 1;
				continue;
			}
			// Valid JSON with a known type but failed schema validation.
			// Skip past it silently rather than dumping raw JSON as text.
			const record = parsed as Record<string, unknown>;
			if (typeof record.type === "string" && hasComponent(record.type)) {
				searchIndex = endIndex + 1;
				continue;
			}
		} catch {
			// Invalid JSON, skip
		}

		// Not a valid component, continue searching
		searchIndex = startIndex + COMPONENT_START.length;
	}

	return { segments };
}

