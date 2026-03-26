"use client";

import {
	ArrowRightIcon,
	BugIcon,
	ChartLineUpIcon,
	CopyIcon,
	GaugeIcon,
	LightningIcon,
	LinkIcon,
	RocketIcon,
	SparkleIcon,
	ThumbsDownIcon,
	ThumbsUpIcon,
	TrendDownIcon,
	TrendUpIcon,
	WarningCircleIcon,
	XIcon,
} from "@phosphor-icons/react";
import { generateId } from "ai";
import Link from "next/link";
import { type ReactNode, useMemo } from "react";
import { toast } from "sonner";
import type {
	Insight,
	InsightSentiment,
	InsightSeverity,
	InsightType,
} from "@/app/(main)/home/hooks/use-smart-insights";
import {
	buildInsightCopyText,
	buildInsightShareUrl,
	formatComparisonWindow,
	formatInsightFreshness,
} from "@/app/(main)/insights/lib/insight-meta";
import type { InsightFeedbackVote } from "@/app/(main)/insights/lib/insight-feedback-vote";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<
	InsightType,
	{ icon: ReactNode; color: string; bg: string }
> = {
	error_spike: {
		icon: <BugIcon className="size-4" weight="duotone" />,
		color: "text-red-500",
		bg: "bg-red-500/10",
	},
	new_errors: {
		icon: <BugIcon className="size-4" weight="duotone" />,
		color: "text-amber-500",
		bg: "bg-amber-500/10",
	},
	vitals_degraded: {
		icon: <GaugeIcon className="size-4" weight="duotone" />,
		color: "text-amber-500",
		bg: "bg-amber-500/10",
	},
	custom_event_spike: {
		icon: <LightningIcon className="size-4" weight="fill" />,
		color: "text-blue-500",
		bg: "bg-blue-500/10",
	},
	traffic_drop: {
		icon: <TrendDownIcon className="size-4" weight="fill" />,
		color: "text-red-500",
		bg: "bg-red-500/10",
	},
	traffic_spike: {
		icon: <TrendUpIcon className="size-4" weight="fill" />,
		color: "text-emerald-500",
		bg: "bg-emerald-500/10",
	},
	bounce_rate_change: {
		icon: <TrendDownIcon className="size-4" weight="fill" />,
		color: "text-amber-500",
		bg: "bg-amber-500/10",
	},
	engagement_change: {
		icon: <ChartLineUpIcon className="size-4" weight="duotone" />,
		color: "text-blue-500",
		bg: "bg-blue-500/10",
	},
	referrer_change: {
		icon: <ChartLineUpIcon className="size-4" weight="duotone" />,
		color: "text-violet-500",
		bg: "bg-violet-500/10",
	},
	page_trend: {
		icon: <ChartLineUpIcon className="size-4" weight="duotone" />,
		color: "text-blue-500",
		bg: "bg-blue-500/10",
	},
	positive_trend: {
		icon: <TrendUpIcon className="size-4" weight="fill" />,
		color: "text-emerald-500",
		bg: "bg-emerald-500/10",
	},
	performance: {
		icon: <RocketIcon className="size-4" weight="duotone" />,
		color: "text-violet-500",
		bg: "bg-violet-500/10",
	},
	uptime_issue: {
		icon: <WarningCircleIcon className="size-4" weight="duotone" />,
		color: "text-red-500",
		bg: "bg-red-500/10",
	},
};

const SEVERITY_STYLES: Record<
	InsightSeverity,
	{ label: string; color: string; bg: string }
> = {
	critical: {
		label: "Critical",
		color: "text-red-600 dark:text-red-400",
		bg: "bg-red-500/10",
	},
	warning: {
		label: "Warning",
		color: "text-amber-600 dark:text-amber-400",
		bg: "bg-amber-500/10",
	},
	info: {
		label: "Info",
		color: "text-blue-600 dark:text-blue-400",
		bg: "bg-blue-500/10",
	},
};

const SENTIMENT_STYLES: Record<
	InsightSentiment,
	{ label: string; color: string }
> = {
	positive: { label: "Positive", color: "text-emerald-600" },
	neutral: { label: "Neutral", color: "text-muted-foreground" },
	negative: { label: "Needs attention", color: "text-red-500" },
};

function buildDiagnosticPrompt(insight: Insight): string {
	const parts = [
		`Diagnose this issue on ${insight.websiteName ?? insight.websiteDomain}:`,
		`"${insight.title}"`,
		"",
		`Context: ${insight.description}`,
	];

	if (insight.changePercent !== undefined && insight.changePercent > 0) {
		parts.push(
			`Change: ${insight.sentiment === "negative" ? "-" : "+"}${insight.changePercent}%`
		);
	}

	parts.push(
		"",
		"Investigate the root cause, check the relevant data for the last 7 days, and provide a clear explanation of what's happening and specific steps to fix or improve it."
	);

	return parts.join("\n");
}

export interface InsightCardProps {
	insight: Insight;
	onDismissAction?: () => void;
	feedbackVote?: InsightFeedbackVote | null;
	onFeedbackAction?: (vote: InsightFeedbackVote | null) => void;
}

export function InsightCard({
	insight,
	onDismissAction,
	feedbackVote,
	onFeedbackAction,
}: InsightCardProps) {
	const typeStyle = TYPE_STYLES[insight.type];
	const severityStyle = SEVERITY_STYLES[insight.severity];
	const sentimentStyle = SENTIMENT_STYLES[insight.sentiment];

	const agentHref = useMemo(() => {
		const chatId = generateId();
		const prompt = encodeURIComponent(buildDiagnosticPrompt(insight));
		return `/websites/${insight.websiteId}/agent/${chatId}?prompt=${prompt}`;
	}, [insight]);

	const comparisonLine = formatComparisonWindow(insight);
	const freshnessLine = formatInsightFreshness(insight);

	const copySummaryAction = async () => {
		try {
			await navigator.clipboard.writeText(buildInsightCopyText(insight));
			toast.success("Copied insight to clipboard");
		} catch {
			toast.error("Could not copy");
		}
	};

	const copyLinkAction = async () => {
		const url = buildInsightShareUrl(insight.id);
		if (!url) {
			return;
		}
		try {
			await navigator.clipboard.writeText(url);
			toast.success("Copied link to this insight");
		} catch {
			toast.error("Could not copy link");
		}
	};

	return (
		<div
			className="scroll-mt-24 rounded border bg-card"
			id={`insight-${insight.id}`}
		>
			<div className="flex items-start gap-3 p-4">
				<div
					className={cn(
						"mt-0.5 flex size-8 shrink-0 items-center justify-center rounded",
						typeStyle.bg,
						typeStyle.color
					)}
				>
					{typeStyle.icon}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-2">
						<p className="font-medium text-foreground text-sm">
							{insight.title}
						</p>
						<div className="flex shrink-0 items-center gap-1">
							{onDismissAction && (
								<button
									aria-label="Dismiss insight"
									className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
									onClick={onDismissAction}
									type="button"
								>
									<XIcon className="size-3.5" weight="bold" />
								</button>
							)}
							<span
								className={cn(
									"rounded px-1.5 py-0.5 font-medium text-[11px]",
									severityStyle.bg,
									severityStyle.color
								)}
							>
								{severityStyle.label}
							</span>
							<span className="font-mono text-[11px] text-muted-foreground tabular-nums">
								{insight.priority}/10
							</span>
						</div>
					</div>
					<div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
						<span className="truncate text-muted-foreground">
							{insight.websiteName ?? insight.websiteDomain}
						</span>
						<span className="text-muted-foreground/30">&middot;</span>
						<span className={sentimentStyle.color}>{sentimentStyle.label}</span>
						{insight.changePercent !== undefined &&
							insight.changePercent > 0 && (
								<>
									<span className="text-muted-foreground/30">&middot;</span>
									<span
										className={cn(
											"tabular-nums",
											insight.sentiment === "negative"
												? "text-red-500"
												: "text-emerald-600"
										)}
									>
										{insight.sentiment === "negative" ? "-" : "+"}
										{insight.changePercent}%
									</span>
								</>
							)}
					</div>
					<p className="mt-1.5 text-pretty text-muted-foreground text-xs leading-relaxed">
						{freshnessLine}
						{comparisonLine ? (
							<>
								<br />
								<span className="text-balance">{comparisonLine}</span>
							</>
						) : null}
					</p>
				</div>
			</div>

			<div className="space-y-3 border-t px-4 py-3">
				<p className="text-pretty text-muted-foreground text-sm leading-relaxed">
					{insight.description}
				</p>
				<div className="flex items-start gap-2 rounded bg-accent/60 px-3 py-2.5">
					<SparkleIcon
						className="mt-px size-3.5 shrink-0 text-primary"
						weight="duotone"
					/>
					<p className="text-pretty text-foreground text-sm leading-relaxed">
						{insight.suggestion}
					</p>
				</div>

				{onFeedbackAction && (
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-muted-foreground text-xs">
							Was this useful?
						</span>
						<button
							aria-label="Mark as helpful"
							aria-pressed={feedbackVote === "up"}
							className={cn(
								"flex size-8 items-center justify-center rounded border transition-colors",
								feedbackVote === "up"
									? "border-primary bg-primary/10 text-primary"
									: "border-transparent bg-accent/50 text-muted-foreground hover:text-foreground"
							)}
							onClick={() =>
								onFeedbackAction(feedbackVote === "up" ? null : "up")
							}
							type="button"
						>
							<ThumbsUpIcon className="size-4" weight="duotone" />
						</button>
						<button
							aria-label="Mark as not helpful"
							aria-pressed={feedbackVote === "down"}
							className={cn(
								"flex size-8 items-center justify-center rounded border transition-colors",
								feedbackVote === "down"
									? "border-destructive bg-destructive/10 text-destructive"
									: "border-transparent bg-accent/50 text-muted-foreground hover:text-foreground"
							)}
							onClick={() =>
								onFeedbackAction(feedbackVote === "down" ? null : "down")
							}
							type="button"
						>
							<ThumbsDownIcon className="size-4" weight="duotone" />
						</button>
					</div>
				)}

				<div className="flex flex-wrap items-center gap-2">
					<Link
						className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-opacity hover:opacity-90"
						href={agentHref}
					>
						Investigate with Databunny
						<ArrowRightIcon className="size-3" weight="fill" />
					</Link>
					<Link
						className="inline-flex items-center gap-1.5 rounded border px-3 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-accent"
						href={insight.link}
					>
						View analytics
					</Link>
					<button
						className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-accent"
						onClick={copySummaryAction}
						type="button"
					>
						<CopyIcon
							aria-hidden
							className="size-3.5 text-muted-foreground"
							weight="duotone"
						/>
						Copy
					</button>
					<button
						className="inline-flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-medium text-foreground text-xs transition-colors hover:bg-accent"
						onClick={copyLinkAction}
						type="button"
					>
						<LinkIcon
							aria-hidden
							className="size-3.5 text-muted-foreground"
							weight="duotone"
						/>
						Copy link
					</button>
				</div>
			</div>
		</div>
	);
}

export function InsightCardSkeleton() {
	return (
		<div className="rounded border bg-card">
			<div className="flex items-start gap-3 p-4">
				<Skeleton className="mt-0.5 size-8 shrink-0 rounded" />
				<div className="min-w-0 flex-1 space-y-2">
					<div className="flex items-start justify-between gap-2">
						<Skeleton className="h-4 w-48 rounded" />
						<Skeleton className="h-5 w-16 shrink-0 rounded" />
					</div>
					<Skeleton className="h-3 w-32 rounded" />
				</div>
			</div>
			<div className="space-y-3 border-t px-4 py-3">
				<div className="space-y-1.5">
					<Skeleton className="h-3 w-full rounded" />
					<Skeleton className="h-3 w-3/4 rounded" />
				</div>
				<Skeleton className="h-12 w-full rounded" />
				<Skeleton className="h-7 w-44 rounded" />
			</div>
		</div>
	);
}
