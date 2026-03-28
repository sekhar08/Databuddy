"use client";

import { CaretDownIcon } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	ChartTooltip,
	createTooltipEntries,
} from "@/components/ui/chart-tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/utils";

interface LatencyDataPoint {
	date: string;
	avg_response_time?: number;
	p95_response_time?: number;
}

interface LatencyChartProps {
	data: LatencyDataPoint[];
	isLoading?: boolean;
	storageKey: string;
}

const METRICS: Array<{
	key: string;
	label: string;
	color: string;
	formatValue: (v: number) => string;
}> = [
	{
		key: "avg_response_time",
		label: "Avg",
		color: "var(--color-chart-1)",
		formatValue: (v) => formatMs(v),
	},
	{
		key: "p95_response_time",
		label: "p95",
		color: "var(--color-chart-4)",
		formatValue: (v) => formatMs(v),
	},
];

function formatMs(ms: number): string {
	if (ms >= 1000) {
		return `${(ms / 1000).toFixed(1)}s`;
	}
	return `${Math.round(ms)}ms`;
}

function formatTickDate(dateStr: string): string {
	try {
		const d = new Date(dateStr);
		const hasTime = dateStr.includes("T") || dateStr.includes(" ");
		if (hasTime) {
			return d.toLocaleString("en-US", {
				month: "short",
				day: "numeric",
				hour: "numeric",
			});
		}
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		});
	} catch {
		return dateStr;
	}
}

function formatTooltipLabel(dateStr: string): string {
	try {
		const d = new Date(dateStr);
		const hasTime = dateStr.includes("T") || dateStr.includes(" ");
		if (hasTime) {
			return d.toLocaleString("en-US", {
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			});
		}
		return d.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

interface ChartDataPoint {
	date: string;
	avg_response_time: number | null;
	p95_response_time: number | null;
}

function toChartData(data: LatencyDataPoint[]): ChartDataPoint[] {
	return data
		.filter((d) => d.avg_response_time != null || d.p95_response_time != null)
		.map((d) => ({
			date: d.date,
			avg_response_time:
				d.avg_response_time == null
					? null
					: Math.round(d.avg_response_time * 100) / 100,
			p95_response_time:
				d.p95_response_time == null
					? null
					: Math.round(d.p95_response_time * 100) / 100,
		}));
}

function computeSummary(chartData: ChartDataPoint[]) {
	if (chartData.length === 0) {
		return { avg: null, p95: null };
	}
	const avgValues = chartData
		.map((d) => d.avg_response_time)
		.filter((v): v is number => v != null);
	const p95Values = chartData
		.map((d) => d.p95_response_time)
		.filter((v): v is number => v != null);

	return {
		avg:
			avgValues.length > 0
				? avgValues.reduce((a, b) => a + b, 0) / avgValues.length
				: null,
		p95:
			p95Values.length > 0
				? p95Values.reduce((a, b) => a + b, 0) / p95Values.length
				: null,
	};
}

export function LatencyChart({
	data,
	isLoading = false,
	storageKey,
}: LatencyChartProps) {
	const [isOpen, setIsOpen] = usePersistentState(storageKey, false);
	const chartData = useMemo(() => toChartData(data), [data]);
	const summary = useMemo(() => computeSummary(chartData), [chartData]);

	return (
		<div>
			<button
				className="flex w-full cursor-pointer items-center gap-3 border-t px-4 py-3 text-left hover:bg-accent/40 sm:px-6"
				onClick={() => setIsOpen((prev) => !prev)}
				type="button"
			>
				<span className="text-balance font-medium text-sm">Response Time</span>

				{!isLoading && summary.avg != null && (
					<span className="flex items-center gap-3 text-muted-foreground text-xs tabular-nums">
						<span>
							<span
								className="mr-1 inline-block size-1.5 rounded-full"
								style={{
									backgroundColor: "var(--color-chart-1)",
								}}
							/>
							avg {formatMs(summary.avg)}
						</span>
						{summary.p95 != null && (
							<span>
								<span
									className="mr-1 inline-block size-1.5 rounded-full"
									style={{
										backgroundColor: "var(--color-chart-4)",
									}}
								/>
								p95 {formatMs(summary.p95)}
							</span>
						)}
					</span>
				)}

				<CaretDownIcon
					className={cn(
						"ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform duration-150",
						isOpen && "rotate-180"
					)}
					weight="fill"
				/>
			</button>

			<AnimatePresence initial={false}>
				{isOpen && (
					<motion.div
						animate={{ height: "auto", opacity: 1 }}
						className="overflow-hidden"
						exit={{ height: 0, opacity: 0 }}
						initial={{ height: 0, opacity: 0 }}
						transition={{ duration: 0.2, ease: "easeOut" }}
					>
						<div className="px-4 pb-4 sm:px-6">
							{isLoading ? (
								<Skeleton className="h-40 w-full rounded" />
							) : chartData.length === 0 ? (
								<div className="flex h-32 items-center justify-center">
									<span className="text-muted-foreground text-sm">
										No response time data
									</span>
								</div>
							) : (
								<LatencyAreaChart data={chartData} />
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function LatencyAreaChart({ data }: { data: ChartDataPoint[] }) {
	const hasVariation = METRICS.some((m) => {
		const values = data
			.map((d) => d[m.key as keyof ChartDataPoint])
			.filter((v) => v != null) as number[];
		return values.length > 1 && values.some((v) => v !== values.at(0));
	});

	if (!hasVariation) {
		return (
			<div className="flex h-32 items-center">
				<div className="h-px w-full bg-chart-1/30" />
			</div>
		);
	}

	return (
		<ResponsiveContainer height={160} width="100%">
			<AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
				<defs>
					{METRICS.map((m) => (
						<linearGradient
							id={`latency-g-${m.key}`}
							key={m.key}
							x1="0"
							x2="0"
							y1="0"
							y2="1"
						>
							<stop offset="0%" stopColor={m.color} stopOpacity={0.15} />
							<stop offset="100%" stopColor={m.color} stopOpacity={0} />
						</linearGradient>
					))}
				</defs>

				<CartesianGrid
					stroke="var(--border)"
					strokeDasharray="3 3"
					strokeOpacity={0.5}
					vertical={false}
				/>

				<XAxis
					axisLine={false}
					dataKey="date"
					interval="preserveStartEnd"
					tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
					tickFormatter={formatTickDate}
					tickLine={false}
				/>

				<YAxis
					axisLine={false}
					domain={["auto", "auto"]}
					tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
					tickFormatter={formatMs}
					tickLine={false}
					width={48}
				/>

				<Tooltip
					content={({ active, payload, label }) => (
						<ChartTooltip
							active={active}
							entries={createTooltipEntries(
								payload as Array<{
									dataKey: string;
									value: number;
									color: string;
								}>,
								METRICS
							)}
							formatLabelAction={formatTooltipLabel}
							label={label}
						/>
					)}
					cursor={{
						stroke: "var(--border)",
						strokeDasharray: "3 3",
					}}
				/>

				{METRICS.map((m) => (
					<Area
						activeDot={{
							r: 2.5,
							fill: m.color,
							stroke: "var(--color-background)",
							strokeWidth: 1.5,
						}}
						connectNulls
						dataKey={m.key}
						dot={false}
						fill={`url(#latency-g-${m.key})`}
						key={m.key}
						name={m.label}
						stroke={m.color}
						strokeWidth={1.5}
						type="monotone"
					/>
				))}
			</AreaChart>
		</ResponsiveContainer>
	);
}
