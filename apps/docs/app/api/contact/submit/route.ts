import { type NextRequest, NextResponse } from "next/server";

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const SLACK_TIMEOUT_MS = 10_000;

const MIN_NAME_LENGTH = 2;

interface ContactFormData {
	fullName: string;
	businessName: string;
	email: string;
	phone?: string;
}

type ValidationResult =
	| { valid: true; data: ContactFormData }
	| { valid: false; errors: string[] };

function getClientIP(request: NextRequest): string {
	const cfConnectingIP = request.headers.get("cf-connecting-ip");
	if (cfConnectingIP) {
		return cfConnectingIP.trim();
	}

	const forwarded = request.headers.get("x-forwarded-for");
	if (forwarded) {
		const firstIP = forwarded.split(",")[0]?.trim();
		if (firstIP) {
			return firstIP;
		}
	}

	const realIP = request.headers.get("x-real-ip");
	if (realIP) {
		return realIP.trim();
	}

	return "unknown";
}

function isValidEmail(email: string): boolean {
	return email.includes("@") && email.includes(".") && email.length > 3;
}

function validateFormData(data: unknown): ValidationResult {
	if (!data || typeof data !== "object") {
		return { valid: false, errors: ["Invalid form data"] };
	}

	const formData = data as Record<string, unknown>;
	const errors: string[] = [];

	const fullName = formData.fullName;
	if (
		!fullName ||
		typeof fullName !== "string" ||
		fullName.trim().length < MIN_NAME_LENGTH
	) {
		errors.push("Full name is required and must be at least 2 characters");
	}

	const businessName = formData.businessName;
	if (
		!businessName ||
		typeof businessName !== "string" ||
		businessName.trim().length < MIN_NAME_LENGTH
	) {
		errors.push(
			"Business or website name is required and must be at least 2 characters"
		);
	}

	const email = formData.email;
	if (!email || typeof email !== "string" || !isValidEmail(email)) {
		errors.push("Valid email is required");
	}

	if (errors.length > 0) {
		return { valid: false, errors };
	}

	const phone = formData.phone;

	return {
		valid: true,
		data: {
			fullName: String(fullName).trim(),
			businessName: String(businessName).trim(),
			email: String(email).trim(),
			phone:
				phone && typeof phone === "string" && phone.trim().length > 0
					? phone.trim()
					: undefined,
		},
	};
}

function createSlackField(label: string, value: string) {
	return {
		type: "mrkdwn" as const,
		text: `*${label}:*\n${value}`,
	};
}

function buildSlackBlocks(data: ContactFormData, ip: string): unknown[] {
	const fields = [
		createSlackField("Full Name", data.fullName),
		createSlackField("Business / Website", data.businessName),
		createSlackField("Email", data.email),
		createSlackField("Phone", data.phone || "Not provided"),
		createSlackField("IP", ip),
	];

	const blocks: unknown[] = [
		{
			type: "header",
			text: {
				type: "plain_text",
				text: "📬 New Contact Lead",
				emoji: true,
			},
		},
	];

	for (let i = 0; i < fields.length; i += 2) {
		blocks.push({
			type: "section",
			fields: fields.slice(i, i + 2),
		});
	}

	return blocks;
}

async function sendToSlack(data: ContactFormData, ip: string): Promise<void> {
	if (!SLACK_WEBHOOK_URL) {
		console.warn(
			"SLACK_WEBHOOK_URL not configured, skipping Slack notification"
		);
		return;
	}

	try {
		const blocks = buildSlackBlocks(data, ip);
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), SLACK_TIMEOUT_MS);

		try {
			const response = await fetch(SLACK_WEBHOOK_URL, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ blocks }),
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const responseText = await response
					.text()
					.catch(() => "Unable to read response");
				console.error(
					{
						status: response.status,
						statusText: response.statusText,
						response: responseText.slice(0, 200),
					},
					"Failed to send Slack webhook"
				);
			}
		} catch (fetchError) {
			clearTimeout(timeoutId);
			if (fetchError instanceof Error && fetchError.name === "AbortError") {
				console.error("Slack webhook request timed out after 10 seconds");
			} else {
				throw fetchError;
			}
		}
	} catch (error) {
		console.error(
			{
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
			"Error sending to Slack webhook"
		);
	}
}

export async function POST(request: NextRequest) {
	const clientIP = getClientIP(request);
	const userAgent = request.headers.get("user-agent") || "unknown";

	try {
		let formData: unknown;
		try {
			formData = await request.json();
		} catch (jsonError) {
			console.warn(
				{
					ip: clientIP,
					userAgent,
					error:
						jsonError instanceof Error ? jsonError.message : String(jsonError),
				},
				"Invalid JSON in request body"
			);
			return NextResponse.json(
				{ error: "Invalid JSON format in request body" },
				{ status: 400 }
			);
		}

		const validation = validateFormData(formData);

		if (!validation.valid) {
			return NextResponse.json(
				{ error: "Validation failed", details: validation.errors },
				{ status: 400 }
			);
		}

		const contactData = validation.data;

		console.info(
			{
				name: contactData.fullName,
				email: contactData.email,
				business: contactData.businessName,
				ip: clientIP,
			},
			`${contactData.fullName} (${contactData.email}) submitted a contact form`
		);

		await sendToSlack(contactData, clientIP);

		return NextResponse.json({
			success: true,
			message: "Contact form submitted successfully",
		});
	} catch (error) {
		console.error(
			{
				ip: clientIP,
				userAgent,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			},
			"Error processing contact form submission"
		);

		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}

export function GET() {
	return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
