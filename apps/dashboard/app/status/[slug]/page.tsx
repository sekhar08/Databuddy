import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getStatusPageUrl } from "@/lib/app-url";
import { publicRPCClient } from "@/lib/orpc-public";
import { LastUpdated } from "./_components/last-updated";
import { Status } from "./_components/status-page";
import { TimeRangeSelector } from "./_components/time-range-selector";

export const revalidate = 60;

interface StatusPageProps {
	params: Promise<{ slug: string }>;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const getStatusData = (slug: string, days: number) =>
	publicRPCClient.statusPage.getBySlug({ slug, days }).catch(() => null);

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function parseDays(raw: string | string[] | undefined): number {
	const n = Number(typeof raw === "string" ? raw : "90");
	if (n === 7 || n === 30) {
		return n;
	}
	return 90;
}

export async function generateMetadata({
	params,
}: StatusPageProps): Promise<Metadata> {
	const { slug } = await params;
	const data = await getStatusData(slug, 90);

	if (!data) {
		return {
			title: "Status Page",
			description: "System status and uptime monitoring",
		};
	}

	const title = `${data.statusPage.name || data.organization.name} Status`;
	const description =
		data.statusPage.description ||
		`Real-time system status for ${data.organization.name}`;
	const url = getStatusPageUrl(slug);

	return {
		title,
		description,
		alternates: {
			canonical: `/status/${slug}`,
		},
		openGraph: {
			title,
			description,
			url,
			type: "website",
			siteName: data.organization.name,
		},
		twitter: {
			card: "summary_large_image",
			title,
			description,
		},
	};
}

export default async function StatusPage({
	params,
	searchParams,
}: StatusPageProps) {
	const { slug } = await params;
	const sp = await searchParams;
	const days = parseDays(sp.days);
	const data = await getStatusData(slug, days);

	if (!data) {
		notFound();
	}

	const latestTimestamp = data.monitors.reduce<string | null>(
		(latest, monitor) => {
			if (!monitor.lastCheckedAt) {
				return latest;
			}
			if (!latest || monitor.lastCheckedAt > latest) {
				return monitor.lastCheckedAt;
			}
			return latest;
		},
		null
	);

	const jsonLd = {
		"@context": "https://schema.org",
		"@type": "WebPage",
		name: `${data.statusPage.name || data.organization.name} Status`,
		description:
			data.statusPage.description ||
			`Real-time system status for ${data.organization.name}`,
		url: getStatusPageUrl(slug),
		publisher: {
			"@type": "Organization",
			name: data.organization.name,
			...(data.organization.logo ? { logo: data.organization.logo } : {}),
		},
	};

	return (
		<>
			<script
				dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
				type="application/ld+json"
			/>
			<Status>
				<Status.Header
					description={data.statusPage.description ?? undefined}
					name={data.statusPage.name}
				/>
				<Status.Banner status={data.overallStatus} />

				<Status.Section
					action={
						<Suspense>
							<TimeRangeSelector currentDays={days} />
						</Suspense>
					}
					title="Monitors"
				>
					{data.monitors.map((monitor) => (
						<Status.MonitorCard
							anchorId={slugify(monitor.name)}
							currentStatus={monitor.currentStatus}
							dailyData={monitor.dailyData}
							days={days}
							domain={monitor.domain ?? undefined}
							id={monitor.id}
							key={monitor.id}
							lastCheckedAt={monitor.lastCheckedAt}
							name={monitor.name}
							uptimePercentage={monitor.uptimePercentage ?? undefined}
						/>
					))}
				</Status.Section>

				<Status.Incidents />
				<LastUpdated timestamp={latestTimestamp} />
			</Status>
		</>
	);
}
