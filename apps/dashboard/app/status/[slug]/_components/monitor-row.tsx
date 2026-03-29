import {
	CheckCircleIcon,
	MinusCircleIcon,
	WarningCircleIcon,
	XCircleIcon,
} from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { LastChecked } from "./last-checked";
import { MonitorRowInteractive } from "./monitor-row-interactive";

interface DailyData {
	date: string;
	uptime_percentage: number;
	avg_response_time?: number;
	p95_response_time?: number;
}

interface MonitorRowProps {
	id: string;
	anchorId: string;
	name: string;
	domain: string;
	currentStatus: "up" | "down" | "degraded" | "unknown";
	uptimePercentage: number;
	dailyData: DailyData[];
	days: number;
	lastCheckedAt: string | null;
}

const STATUS_ICON = {
	up: {
		Icon: CheckCircleIcon,
		className: "text-emerald-500",
		label: "Operational",
	},
	degraded: {
		Icon: WarningCircleIcon,
		className: "text-amber-500",
		label: "Degraded",
	},
	down: { Icon: XCircleIcon, className: "text-red-500", label: "Down" },
	unknown: {
		Icon: MinusCircleIcon,
		className: "text-muted-foreground",
		label: "Unknown",
	},
} as const;

export function MonitorRow({
	id,
	anchorId,
	name,
	domain,
	currentStatus,
	uptimePercentage,
	dailyData,
	days,
	lastCheckedAt,
}: MonitorRowProps) {
	const statusConfig = STATUS_ICON[currentStatus];
	const hasLatencyData = dailyData.some(
		(d) => d.avg_response_time != null || d.p95_response_time != null
	);

	return (
		<div
			className="scroll-mt-20 overflow-hidden rounded border bg-card"
			id={anchorId}
		>
			<div className="flex items-center justify-between px-4 pt-4 pb-3">
				<div className="flex items-center gap-2.5 overflow-hidden">
					<statusConfig.Icon
						className={cn("size-5 shrink-0", statusConfig.className)}
						weight="fill"
					/>
					<div className="min-w-0">
						<p className="truncate font-medium text-sm">{name}</p>
						<p className="truncate text-muted-foreground text-xs">{domain}</p>
					</div>
				</div>
				<div className="shrink-0 text-right">
					<p className="font-medium font-mono text-sm tabular-nums">
						{uptimePercentage.toFixed(2)}%
					</p>
					{lastCheckedAt ? <LastChecked timestamp={lastCheckedAt} /> : null}
				</div>
			</div>

			<MonitorRowInteractive
				dailyData={dailyData}
				days={days}
				hasLatencyData={hasLatencyData}
				id={id}
			/>
		</div>
	);
}
