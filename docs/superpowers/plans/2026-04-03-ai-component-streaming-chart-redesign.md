# AI Component Streaming & Chart Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI chart components to use the dashboard's composable chart system and add progressive rendering during streaming via partial JSON repair.

**Architecture:** The parser detects incomplete JSON during streaming and repairs it to extract partial data. Chart renderers are rewritten using the `Chart` composable shell with dashboard presentation tokens. Row-oriented data format enables charts to grow incrementally as data streams in.

**Tech Stack:** React 19, Recharts (via Chart composable), Zod 4, Vercel AI SDK, TailwindCSS 4

---

### Task 1: Update Types for Row-Oriented Format

**Files:**
- Modify: `apps/dashboard/lib/ai-components/types.ts`

- [ ] **Step 1: Replace chart input types and add streaming segment**

Replace the old column-oriented `TimeSeriesInput`, `DistributionInput`, and `DataTableInput` with row-oriented versions, and add the `streaming-component` segment type:

```typescript
// Replace lines 31-33 (ContentSegment type)
export type ContentSegment =
	| { type: "text"; content: string }
	| { type: "component"; content: RawComponentInput }
	| { type: "streaming-component"; content: RawComponentInput };

// Replace lines 45-61 (TimeSeriesInput and DistributionInput)
export interface TimeSeriesInput {
	type: string;
	title?: string;
	series: string[];
	rows: unknown[][];
}

export interface DistributionInput {
	type: string;
	title?: string;
	rows: unknown[][];
}

// Replace lines 196-210 (DataTableInput - remove DataTableColumn, flatten)
export interface DataTableInput {
	type: "data-table";
	title?: string;
	description?: string;
	columns: string[];
	align?: ("left" | "center" | "right")[];
	rows: unknown[][];
	footer?: string;
}
```

Keep all other types (LinksListInput, FunnelsListInput, etc.) unchanged.

- [ ] **Step 2: Verify no type errors**

Run: `cd apps/dashboard && npx tsc --noEmit 2>&1 | grep -c "error TS"` to get baseline count. The type changes will cause errors in registry.tsx, renderers, and schemas.ts -- those are expected and will be fixed in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/ai-components/types.ts
git commit -m "refactor(dashboard): row-oriented chart types and streaming segment"
```

---

### Task 2: Partial JSON Repair in Parser

**Files:**
- Modify: `apps/dashboard/lib/ai-components/parser.ts`

- [ ] **Step 1: Add repairPartialJSON function**

Add above `parseContentSegments`:

```typescript
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
	const trailingDanglingKV = /,\s*"[^"]*"\s*:\s*("[^"]*"?|[\d.]*|true|false|null|\[[\s\S]*?)?\s*$/;
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
```

- [ ] **Step 2: Update parseContentSegments to handle streaming**

Replace the `if (endIndex === -1)` block (lines 69-76) that currently treats unclosed braces as text:

```typescript
		if (endIndex === -1) {
			// JSON is still streaming — attempt partial repair
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
						// Add any text before the component
						const textBefore = content
							.substring(searchIndex, startIndex)
							.trim();
						if (textBefore) {
							segments.push({ type: "text", content: textBefore });
						}
						segments.push({
							type: "streaming-component",
							content: record as RawComponentInput,
						});
						break;
					}
				} catch {
					// Repair produced invalid JSON, fall through to text
				}
			}

			// Repair failed — treat as text
			const remainingText = content.substring(searchIndex).trim();
			if (remainingText) {
				segments.push({ type: "text", content: remainingText });
			}
			break;
		}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/ai-components/parser.ts
git commit -m "feat(dashboard): partial JSON repair for streaming AI components"
```

---

### Task 3: Update Zod Schemas for Row-Oriented Format

**Files:**
- Modify: `apps/dashboard/lib/ai-components/schemas.ts`

- [ ] **Step 1: Rewrite chart schemas**

Replace `timeSeriesSchema`, `distributionSchema`, and `dataTableSchema`:

```typescript
// --- Time Series (line-chart, bar-chart, area-chart, stacked-bar-chart) ---

export const timeSeriesSchema = z
	.object({
		type: z.string(),
		title: z.string().optional(),
		series: z.array(z.string()),
		rows: z.array(z.array(z.union([z.string(), z.number()]))),
	})
	.passthrough();

// --- Distribution (pie-chart, donut-chart) ---

export const distributionSchema = z
	.object({
		type: z.string(),
		title: z.string().optional(),
		rows: z.array(z.array(z.union([z.string(), z.number()]))),
	})
	.passthrough();

// --- Data Table ---

export const dataTableSchema = z
	.object({
		type: z.literal("data-table"),
		title: z.string().optional(),
		description: z.string().optional(),
		columns: z.array(z.string()),
		align: z.array(z.enum(["left", "center", "right"])).optional(),
		rows: z.array(z.array(z.union([z.string(), z.number(), z.boolean(), z.null()]))),
		footer: z.string().optional(),
	})
	.passthrough();
```

Remove the old `dataTableColumnSchema` since columns are now flat strings. Leave all non-chart schemas unchanged.

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/lib/ai-components/schemas.ts
git commit -m "refactor(dashboard): update Zod schemas for row-oriented chart format"
```

---

### Task 4: Update Registry Validators and Transforms

**Files:**
- Modify: `apps/dashboard/lib/ai-components/registry.tsx`

- [ ] **Step 1: Replace time-series validator and transform**

Replace `isTimeSeriesInput` and `toTimeSeriesProps`:

```typescript
function isTimeSeriesInput(
	input: RawComponentInput
): input is RawComponentInput & TimeSeriesInput {
	if (!Array.isArray(input.series) || !Array.isArray(input.rows)) return false;
	if (input.series.length === 0) return false;
	return input.series.every((s: unknown) => typeof s === "string");
}

function toTimeSeriesProps(input: TimeSeriesInput): TimeSeriesProps {
	const series = input.series;
	const data = input.rows
		.filter(
			(row): row is [string, ...number[]] =>
				Array.isArray(row) && row.length === series.length + 1
		)
		.map(([x, ...values]) => ({
			x: String(x),
			...Object.fromEntries(series.map((key, i) => [key, Number(values[i]) || 0])),
		}));

	const variant = input.type.replace("-chart", "") as TimeSeriesProps["variant"];
	return { variant: variant === "stacked-bar" ? "stacked-bar" : variant, title: input.title, data, series };
}
```

- [ ] **Step 2: Replace distribution validator and transform**

```typescript
function isDistributionInput(
	input: RawComponentInput
): input is RawComponentInput & DistributionInput {
	if (!Array.isArray(input.rows)) return false;
	return input.rows.length > 0;
}

function toDistributionProps(input: DistributionInput): DistributionProps {
	const data = input.rows
		.filter((row): row is [string, number] => Array.isArray(row) && row.length >= 2)
		.map(([name, value]) => ({ name: String(name), value: Number(value) }));

	return {
		variant: input.type === "donut-chart" ? "donut" : "pie",
		title: input.title,
		data,
	};
}
```

- [ ] **Step 3: Replace data-table validator and transform**

```typescript
function isDataTableInput(
	input: RawComponentInput
): input is RawComponentInput & DataTableInput {
	if (input.type !== "data-table") return false;
	return Array.isArray(input.columns) && Array.isArray(input.rows);
}

function toDataTableProps(input: DataTableInput): DataTableProps {
	const alignArr = input.align ?? [];
	const columns = input.columns.map((header, i) => ({
		key: String(i),
		header: String(header),
		align: (alignArr[i] ?? "left") as "left" | "center" | "right",
	}));
	const rows = input.rows
		.filter((row) => Array.isArray(row))
		.map((row) =>
			Object.fromEntries(
				input.columns.map((_, i) => [String(i), row[i] ?? null])
			)
		);
	return { title: input.title, description: input.description, columns, rows, footer: input.footer };
}
```

Note: The data-table transform converts from flat arrays back to the keyed format the `DataTableRenderer` already expects. This avoids rewriting the table renderer.

- [ ] **Step 4: Commit**

```bash
git add apps/dashboard/lib/ai-components/registry.tsx
git commit -m "refactor(dashboard): row-oriented validators and transforms for charts"
```

---

### Task 5: Update AIComponent for Streaming Prop

**Files:**
- Modify: `apps/dashboard/components/ai-elements/ai-component.tsx`

- [ ] **Step 1: Add streaming prop and pass to renderers**

```typescript
"use client";

import {
	getComponent,
	hasComponent,
	type RawComponentInput,
} from "@/lib/ai-components";

interface AIComponentProps {
	input: RawComponentInput;
	className?: string;
	streaming?: boolean;
}

/**
 * Renders an AI-generated component based on its type.
 * When streaming=true, renderers show progressive/skeleton states.
 */
export function AIComponent({ input, className, streaming }: AIComponentProps) {
	if (!hasComponent(input.type)) {
		return null;
	}

	const definition = getComponent(input.type);
	if (!definition) {
		return null;
	}

	if (!definition.validate(input)) {
		return null;
	}

	const props = definition.transform(input);
	const Component = definition.component;

	return <Component {...props} className={className} streaming={streaming} />;
}
```

- [ ] **Step 2: Update BaseComponentProps in types.ts**

Add `streaming` to the base props so all renderers can receive it:

```typescript
export interface BaseComponentProps {
	className?: string;
	streaming?: boolean;
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/components/ai-elements/ai-component.tsx apps/dashboard/lib/ai-components/types.ts
git commit -m "feat(dashboard): pass streaming prop through AIComponent to renderers"
```

---

### Task 6: Rewrite Time-Series Renderer with Chart Composable

**Files:**
- Modify: `apps/dashboard/lib/ai-components/renderers/charts/time-series.tsx`
- Modify: `apps/dashboard/lib/ai-components/renderers/config.ts`

- [ ] **Step 1: Update config.ts to use composable palette**

Replace the entire file:

```typescript
import { chartSeriesColorAtIndex } from "@/lib/chart-presentation";

/**
 * Get a theme-aware chart color by index.
 * Uses the dashboard's CSS variable palette for consistency.
 */
export const getChartColor = chartSeriesColorAtIndex;
```

- [ ] **Step 2: Rewrite time-series renderer**

Replace the entire `time-series.tsx`:

```typescript
"use client";

import { useCallback, useMemo, useState } from "react";
import { ChartErrorBoundary } from "@/components/chart-error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Chart } from "@/components/ui/composables/chart";
import {
	chartAxisTickDefault,
	chartAxisYWidthCompact,
	chartCartesianGridDefault,
	chartLegendPillClassName,
	chartLegendPillDotClassName,
	chartLegendPillLabelClassName,
	chartLegendPillRowClassName,
	chartSeriesColorAtIndex,
	chartSurfaceClassName,
	chartTooltipSingleShellClassName,
} from "@/lib/chart-presentation";
import dayjs from "@/lib/dayjs";
import { formatMetricNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ChartComponentProps } from "../../types";

const {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} = Chart.Recharts;

export interface TimeSeriesProps extends ChartComponentProps {
	variant: "line" | "bar" | "area" | "stacked-bar";
	data: Record<string, string | number>[];
	series: string[];
}

const PLOT_HEIGHT = 200;

const formatDateTick = (value: string) => {
	const parsed = dayjs(value);
	return parsed.isValid() ? parsed.format("MMM D") : value;
};

const formatDateLabel = (value: string) => {
	const parsed = dayjs(value);
	return parsed.isValid() ? parsed.format("MMM D, YYYY") : value;
};

export function TimeSeriesRenderer({
	variant,
	title,
	data,
	series,
	className,
	streaming,
}: TimeSeriesProps) {
	const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

	const visibleSeries = useMemo(
		() => series.filter((s) => !hiddenSeries.has(s)),
		[series, hiddenSeries]
	);

	const toggleSeries = useCallback((key: string) => {
		setHiddenSeries((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}, []);

	const isSkeleton = data.length === 0;

	const tooltipContent = useCallback(
		({
			active,
			payload,
			label,
		}: {
			active?: boolean;
			payload?: Array<{ value?: number; dataKey?: string | number; color?: string }>;
			label?: string;
		}) => {
			if (!(active && payload?.length)) return null;
			return (
				<div className={chartTooltipSingleShellClassName}>
					<p className="mb-1 text-[10px] text-muted-foreground">
						{formatDateLabel(String(label ?? ""))}
					</p>
					{payload.map((entry) => (
						<p className="font-semibold text-foreground text-sm tabular-nums" key={entry.dataKey}>
							{formatMetricNumber(entry.value ?? 0)}{" "}
							<span className="font-normal text-muted-foreground">{entry.dataKey}</span>
						</p>
					))}
				</div>
			);
		},
		[]
	);

	const chartProps = {
		data,
		margin: { top: 4, right: 4, left: 0, bottom: 0 },
	};

	const renderChart = () => {
		const axisProps = {
			axisLine: false,
			tickLine: false,
			tick: chartAxisTickDefault,
		};

		const xAxisProps = {
			...axisProps,
			dataKey: "x" as const,
			tickFormatter: formatDateTick,
		};

		const yAxisProps = {
			...axisProps,
			width: chartAxisYWidthCompact,
			tickFormatter: (v: number) => formatMetricNumber(v),
		};

		if (variant === "bar" || variant === "stacked-bar") {
			return (
				<BarChart {...chartProps}>
					<CartesianGrid {...chartCartesianGridDefault} />
					<XAxis {...xAxisProps} />
					<YAxis {...yAxisProps} />
					<Tooltip content={tooltipContent} cursor={{ fill: "var(--accent)", fillOpacity: 0.5 }} />
					{visibleSeries.map((key, idx) => (
						<Bar
							key={key}
							dataKey={key}
							fill={chartSeriesColorAtIndex(series.indexOf(key))}
							radius={variant === "stacked-bar" ? (idx === visibleSeries.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]) : [3, 3, 0, 0]}
							stackId={variant === "stacked-bar" ? "stack" : undefined}
						/>
					))}
				</BarChart>
			);
		}

		if (variant === "line") {
			return (
				<LineChart {...chartProps}>
					<CartesianGrid {...chartCartesianGridDefault} />
					<XAxis {...xAxisProps} />
					<YAxis {...yAxisProps} />
					<Tooltip content={tooltipContent} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
					{visibleSeries.map((key) => (
						<Line
							key={key}
							dataKey={key}
							stroke={chartSeriesColorAtIndex(series.indexOf(key))}
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 3, strokeWidth: 0 }}
							type="monotone"
						/>
					))}
				</LineChart>
			);
		}

		// area (default)
		return (
			<AreaChart {...chartProps}>
				<CartesianGrid {...chartCartesianGridDefault} />
				<XAxis {...xAxisProps} />
				<YAxis {...yAxisProps} />
				<Tooltip content={tooltipContent} cursor={{ stroke: "var(--border)", strokeDasharray: "4 4" }} />
				{visibleSeries.map((key) => {
					const color = chartSeriesColorAtIndex(series.indexOf(key));
					return (
						<Area
							key={key}
							dataKey={key}
							stroke={color}
							fill={color}
							fillOpacity={0.1}
							strokeWidth={2}
							dot={false}
							activeDot={{ r: 3, strokeWidth: 0 }}
							type="monotone"
						/>
					);
				})}
			</AreaChart>
		);
	};

	return (
		<div className={cn(chartSurfaceClassName, className)}>
			<div className="dotted-bg bg-accent">
				{isSkeleton ? (
					<Skeleton className="h-[200px] w-full rounded-none" />
				) : (
					<ChartErrorBoundary fallbackClassName={`h-[${PLOT_HEIGHT}px] w-full`}>
						<ResponsiveContainer height={PLOT_HEIGHT} width="100%">
							{renderChart()}
						</ResponsiveContainer>
					</ChartErrorBoundary>
				)}
			</div>
			<div className="flex items-center gap-2.5 border-t px-3 py-2">
				{title && (
					<p className="min-w-0 flex-1 truncate font-medium text-sm">
						{title}
					</p>
				)}
				<div className={chartLegendPillRowClassName}>
					{series.map((key) => {
						const color = chartSeriesColorAtIndex(series.indexOf(key));
						const hidden = hiddenSeries.has(key);
						return (
							<button
								key={key}
								type="button"
								onClick={() => toggleSeries(key)}
								className={cn(chartLegendPillClassName, hidden && "opacity-40")}
							>
								<div
									className={chartLegendPillDotClassName}
									style={{ backgroundColor: hidden ? "var(--muted-foreground)" : color }}
								/>
								<span className={chartLegendPillLabelClassName}>{key}</span>
							</button>
						);
					})}
				</div>
			</div>
			{streaming && !isSkeleton && (
				<div className="h-0.5 w-full overflow-hidden">
					<div className="h-full w-1/3 animate-pulse rounded bg-primary/30" style={{ animation: "pulse 1.5s ease-in-out infinite" }} />
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/lib/ai-components/renderers/charts/time-series.tsx apps/dashboard/lib/ai-components/renderers/config.ts
git commit -m "feat(dashboard): rewrite time-series renderer with Chart composable"
```

---

### Task 7: Rewrite Distribution Renderer with Chart Composable

**Files:**
- Modify: `apps/dashboard/lib/ai-components/renderers/charts/distribution.tsx`

- [ ] **Step 1: Rewrite distribution renderer**

Replace the entire file:

```typescript
"use client";

import { useCallback, useState } from "react";
import { ChartErrorBoundary } from "@/components/chart-error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { Chart } from "@/components/ui/composables/chart";
import {
	chartLegendPillClassName,
	chartLegendPillDotClassName,
	chartLegendPillLabelClassName,
	chartLegendPillRowClassName,
	chartSeriesColorAtIndex,
	chartSurfaceClassName,
	chartTooltipSingleShellClassName,
} from "@/lib/chart-presentation";
import { formatMetricNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { ChartComponentProps } from "../../types";

const { Cell, Pie, PieChart, ResponsiveContainer, Sector, Tooltip } =
	Chart.Recharts;

export interface DistributionProps extends ChartComponentProps {
	variant: "pie" | "donut";
	data: Array<{ name: string; value: number }>;
}

const PLOT_HEIGHT = 220;

const renderActiveShape = (props: {
	cx: number;
	cy: number;
	innerRadius: number;
	outerRadius: number;
	startAngle: number;
	endAngle: number;
	fill: string;
}) => (
	<g>
		<Sector
			cx={props.cx}
			cy={props.cy}
			innerRadius={props.innerRadius}
			outerRadius={props.outerRadius + 4}
			startAngle={props.startAngle}
			endAngle={props.endAngle}
			fill={props.fill}
		/>
	</g>
);

export function DistributionRenderer({
	variant,
	title,
	data,
	className,
	streaming,
}: DistributionProps) {
	const [activeIndex, setActiveIndex] = useState(-1);
	const total = data.reduce((sum, item) => sum + item.value, 0);

	const onPieEnter = useCallback((_: unknown, index: number) => {
		setActiveIndex(index);
	}, []);

	const onPieLeave = useCallback(() => {
		setActiveIndex(-1);
	}, []);

	const isSkeleton = data.length === 0;

	return (
		<div className={cn(chartSurfaceClassName, className)}>
			<div className="dotted-bg bg-accent p-4">
				{isSkeleton ? (
					<Skeleton className="mx-auto size-[160px] rounded-full" />
				) : (
					<ChartErrorBoundary fallbackClassName={`h-[${PLOT_HEIGHT}px] w-full`}>
						<ResponsiveContainer height={PLOT_HEIGHT} width="100%">
							<PieChart>
								<Pie
									activeIndex={activeIndex}
									activeShape={renderActiveShape as never}
									cx="50%"
									cy="50%"
									data={data}
									dataKey="value"
									innerRadius={variant === "donut" ? 50 : 0}
									nameKey="name"
									onMouseEnter={onPieEnter}
									onMouseLeave={onPieLeave}
									outerRadius={80}
									paddingAngle={1}
									isAnimationActive={!streaming}
								>
									{data.map((_, index) => (
										<Cell
											key={`cell-${index}`}
											fill={chartSeriesColorAtIndex(index)}
											stroke="var(--background)"
											strokeWidth={2}
										/>
									))}
								</Pie>
								<Tooltip
									content={({ active, payload }) => {
										if (!(active && payload?.length)) return null;
										const item = payload[0];
										if (!item || typeof item.value !== "number") return null;
										const pct = total > 0 ? (item.value / total) * 100 : 0;
										return (
											<div className={chartTooltipSingleShellClassName}>
												<p className="font-medium text-foreground text-xs">{item.name}</p>
												<p className="text-muted-foreground text-xs tabular-nums">
													{formatMetricNumber(item.value)} ({pct.toFixed(1)}%)
												</p>
											</div>
										);
									}}
									wrapperStyle={{ outline: "none" }}
								/>
							</PieChart>
						</ResponsiveContainer>
					</ChartErrorBoundary>
				)}
			</div>
			<div className="flex items-center gap-2.5 border-t px-3 py-2">
				{title && (
					<p className="min-w-0 flex-1 truncate font-medium text-sm">
						{title || "Distribution"}
					</p>
				)}
				<div className={chartLegendPillRowClassName}>
					{data.map((item, idx) => (
						<div key={item.name} className={chartLegendPillClassName}>
							<div
								className={chartLegendPillDotClassName}
								style={{ backgroundColor: chartSeriesColorAtIndex(idx) }}
							/>
							<span className={chartLegendPillLabelClassName}>{item.name}</span>
						</div>
					))}
				</div>
			</div>
			{streaming && !isSkeleton && (
				<div className="h-0.5 w-full overflow-hidden">
					<div className="h-full w-1/3 animate-pulse rounded bg-primary/30" />
				</div>
			)}
		</div>
	);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/lib/ai-components/renderers/charts/distribution.tsx
git commit -m "feat(dashboard): rewrite distribution renderer with Chart composable"
```

---

### Task 8: Update Data Table Renderer for Flat Format

**Files:**
- Modify: `apps/dashboard/lib/ai-components/renderers/data-table.tsx`

- [ ] **Step 1: Update DataTableProps and renderer**

The data table's internal DataTableColumn and DataTableProps stay the same (since the registry transform in Task 4 converts flat arrays to keyed objects). The only change is removing the import of `DataTableColumn` from types.ts (it's now defined locally) and ensuring the local interface matches.

Verify the local `DataTableColumn` interface and `DataTableProps` in data-table.tsx already define the keyed format:

```typescript
export interface DataTableColumn {
	key: string;
	header: string;
	align?: "left" | "center" | "right";
}

export interface DataTableProps extends BaseComponentProps {
	title?: string;
	description?: string;
	columns: DataTableColumn[];
	rows: Record<string, string | number | boolean | null>[];
	footer?: string;
}
```

These are already correct -- the registry transform (Task 4) produces this format from the flat arrays. No renderer changes needed.

Add streaming support (fade-in on last row):

After the `<tbody>` opening tag, add a className to the last row when streaming:

```typescript
<tr
	className={cn(
		"border-b transition-colors last:border-b-0 hover:bg-muted/50",
		streaming && rowIdx === rows.length - 1 && "animate-in fade-in duration-300"
	)}
	key={rowIdx}
>
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/lib/ai-components/renderers/data-table.tsx
git commit -m "feat(dashboard): add streaming fade-in to data table rows"
```

---

### Task 9: Wire Streaming Segment into Agent Messages

**Files:**
- Modify: `apps/dashboard/app/(main)/websites/[id]/agent/_components/agent-messages.tsx`

- [ ] **Step 1: Handle streaming-component segment type**

Find the segment rendering block (where `segments.map` iterates) and add handling for `streaming-component`:

```typescript
{segments.map((segment, idx) => {
	if (segment.type === "text") {
		return (
			<MessageResponse
				isAnimating={isCurrentlyStreaming}
				key={`${key}-text-${idx}`}
				mode={mode}
			>
				{segment.content}
			</MessageResponse>
		);
	}
	// Both complete and streaming components render via AIComponent
	return (
		<AIComponent
			input={segment.content}
			key={`${key}-component-${idx}`}
			streaming={segment.type === "streaming-component"}
		/>
	);
})}
```

This replaces the current `segment.type === "component"` return that doesn't pass `streaming`.

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/app/(main)/websites/[id]/agent/_components/agent-messages.tsx
git commit -m "feat(dashboard): render streaming-component segments with streaming prop"
```

---

### Task 10: Update Agent Prompts for Row-Oriented Format

**Files:**
- Modify: `apps/api/src/ai/prompts/analytics.ts`

- [ ] **Step 1: Replace ANALYTICS_CHART_RULES**

Replace the entire `ANALYTICS_CHART_RULES` constant with the new row-oriented format examples:

```typescript
const ANALYTICS_CHART_RULES = `
**Charts:**
When presenting data visually, use the JSON chart format on its own line.

Time-series (line-chart, bar-chart, area-chart, stacked-bar-chart):
{"type":"line-chart","title":"Traffic Over Time","series":["pageviews","visitors"],"rows":[["Mon",100,80],["Tue",150,110],["Wed",120,90]]}
{"type":"bar-chart","title":"Top Pages","series":["views"],"rows":[["/page1",1000],["/page2",800],["/page3",600]]}
{"type":"area-chart","title":"Sessions","series":["sessions"],"rows":[["Mon",500],["Tue",600],["Wed",550]]}
{"type":"stacked-bar-chart","title":"Traffic by Source","series":["organic","paid","direct"],"rows":[["Mon",100,50,30],["Tue",120,60,35],["Wed",115,55,40]]}

Distribution (pie-chart, donut-chart):
{"type":"pie-chart","title":"Device Distribution","rows":[["Desktop",650],["Mobile",280],["Tablet",70]]}
{"type":"donut-chart","title":"Traffic Sources","rows":[["Organic",450],["Direct",300],["Referral",150]]}

Data table:
{"type":"data-table","title":"Performance Metrics","columns":["Page","Visitors","Avg Load (ms)"],"align":["left","right","right"],"rows":[["/home",1500,245],["/about",800,180]]}

Referrers list (traffic sources with favicons):
{"type":"referrers-list","title":"Traffic Sources","referrers":[{"name":"Google","domain":"google.com","visitors":500,"percentage":45.5},{"name":"Direct","visitors":300,"percentage":27.3}]}

Mini map (geographic distribution):
{"type":"mini-map","title":"Visitor Locations","countries":[{"name":"United States","country_code":"US","visitors":1200,"percentage":40},{"name":"Germany","country_code":"DE","visitors":500,"percentage":16.7}]}

Links list:
{"type":"links-list","title":"Your Short Links","links":[{"id":"1","name":"Black Friday","slug":"bf24","targetUrl":"https://example.com/sale","createdAt":"2024-01-01T00:00:00Z","expiresAt":null}]}

Link preview (for confirmations):
{"type":"link-preview","mode":"create","link":{"name":"Black Friday Sale","targetUrl":"https://example.com/sale","slug":"(auto-generated)","expiresAt":"Never"}}

Funnel/goal/annotation list and preview components use the same format as before.

Format rules:
- For time-series: "series" lists the metric names, "rows" are [xLabel, value1, value2, ...] matching series order
- For distribution: "rows" are [label, value] pairs
- For data-table: "columns" are header strings, "align" is optional alignment per column, "rows" are positional arrays matching columns
- For referrers-list, mini-map, links-list: use object-per-item format (unchanged)
- JSON must be on its own line, separate from text
- Pick ONE format: either JSON component OR markdown table, never both for the same data`;
```

- [ ] **Step 2: Update ANALYTICS_EXAMPLES to use row-oriented format**

Update the few-shot examples to use the new format. Find the `ANALYTICS_EXAMPLES` constant and update the chart JSON in the examples:

In the second example (full overview), change the chart line to:

```
{"type":"line-chart","title":"Traffic (last 30 days)","series":["pageviews","visitors"],"rows":[["Mar 4",9800,4100],["Mar 11",11200,4600],["Mar 18",12500,5200],["Mar 25",11700,5000]]}
```

In the third example (create funnel), the funnel-preview format is unchanged.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/ai/prompts/analytics.ts
git commit -m "feat(api): update chart prompt rules for row-oriented format"
```

---

### Task 11: Clean Up Old Local Storage and Verify

- [ ] **Step 1: Type-check both apps**

Run:
```bash
cd /Users/iza/Dev/Databuddy && npx tsc --noEmit --project apps/api/tsconfig.json 2>&1 | grep "error TS" | grep "apps/api/src/ai/" | head -10
cd /Users/iza/Dev/Databuddy && npx tsc --noEmit --project apps/dashboard/tsconfig.json 2>&1 | grep "error TS" | grep "ai-components\|ai-component\|agent-messages" | head -10
```

Expected: Zero errors in modified files.

- [ ] **Step 2: Lint**

Run:
```bash
cd /Users/iza/Dev/Databuddy && bun run lint 2>&1 | tail -20
```

Fix any lint issues in modified files.

- [ ] **Step 3: Commit any fixes**

```bash
git add -u
git commit -m "fix(dashboard): lint and type fixes for chart redesign"
```
