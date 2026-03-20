"use client";

import type { CellContext, ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import {
	DataTable,
	type TabConfig,
} from "@/components/table/data-table";
import type {
	OutboundDomainRow,
	OutboundLinkRow,
	OutboundLinksSectionProps,
} from "@/types/outbound-links";

const PROTOCOL_REGEX = /^https?:\/\//;

const formatNumber = (value: number): string => {
	if (value == null || Number.isNaN(value)) {
		return "0";
	}
	return Intl.NumberFormat(undefined, {
		notation: "compact",
		maximumFractionDigits: 1,
	}).format(value);
};

const createDomainIndicator = () => (
	<div className="size-2 shrink-0 rounded bg-blue-500" />
);

const createPercentageBadge = (percentage: number) => {
	const safePercentage =
		percentage == null || Number.isNaN(percentage) ? 0 : percentage;
	return (
		<div className="inline-flex items-center rounded bg-primary/10 px-2 py-1 font-medium text-primary text-xs">
			{safePercentage.toFixed(1)}%
		</div>
	);
};

const createMetricDisplay = (value: number, label: string) => (
	<div>
		<div className="font-medium text-foreground">{formatNumber(value)}</div>
		<div className="text-muted-foreground text-xs">{label}</div>
	</div>
);

const outboundLinksColumns: ColumnDef<OutboundLinkRow, unknown>[] = [
	{
		id: "href",
		accessorKey: "href",
		header: "URL",
		cell: ({ getValue }: CellContext<OutboundLinkRow, unknown>) => {
			const href = getValue();
			if (typeof href !== "string" || !href) {
				return <span className="text-muted-foreground">—</span>;
			}
			const domain = href.replace(PROTOCOL_REGEX, "").split("/")[0];
			return (
				<div className="flex flex-col gap-1">
					<a
						className="max-w-[300px] truncate font-medium text-primary hover:underline"
						href={href}
						rel="noopener noreferrer"
						target="_blank"
						title={href}
					>
						{domain}
					</a>
					<span
						className="max-w-[300px] truncate text-muted-foreground text-xs"
						title={href}
					>
						{href}
					</span>
				</div>
			);
		},
	},
	{
		id: "text",
		accessorKey: "text",
		header: "Text",
		cell: ({ getValue }: CellContext<OutboundLinkRow, unknown>) => {
			const text = getValue();
			const display =
				typeof text === "string" && text.length > 0 ? text : "(no text)";
			return (
				<span className="max-w-[200px] truncate font-medium" title={display}>
					{display}
				</span>
			);
		},
	},
	{
		id: "total_clicks",
		accessorKey: "total_clicks",
		header: "Clicks",
		cell: ({ getValue }: CellContext<OutboundLinkRow, unknown>) => {
			const v = getValue();
			const n = typeof v === "number" ? v : 0;
			return createMetricDisplay(n, "total");
		},
	},
	{
		id: "unique_users",
		accessorKey: "unique_users",
		header: "Users",
		cell: ({ getValue }: CellContext<OutboundLinkRow, unknown>) => {
			const v = getValue();
			const n = typeof v === "number" ? v : 0;
			return createMetricDisplay(n, "unique");
		},
	},
	{
		id: "percentage",
		accessorKey: "percentage",
		header: "Share",
		cell: ({ getValue }: CellContext<OutboundLinkRow, unknown>) => {
			const v = getValue();
			const n = typeof v === "number" ? v : 0;
			return createPercentageBadge(n);
		},
	},
];

const outboundDomainsColumns: ColumnDef<OutboundDomainRow, unknown>[] = [
	{
		id: "domain",
		accessorKey: "domain",
		header: "Domain",
		cell: ({ getValue }: CellContext<OutboundDomainRow, unknown>) => {
			const v = getValue();
			const domain = typeof v === "string" ? v : "";
			return (
				<div className="flex items-center gap-3">
					{createDomainIndicator()}
					<span className="font-medium text-foreground">{domain}</span>
				</div>
			);
		},
	},
	{
		id: "total_clicks",
		accessorKey: "total_clicks",
		header: "Clicks",
		cell: ({ getValue }: CellContext<OutboundDomainRow, unknown>) => {
			const v = getValue();
			const n = typeof v === "number" ? v : 0;
			return createMetricDisplay(n, "total");
		},
	},
	{
		id: "unique_users",
		accessorKey: "unique_users",
		header: "Users",
		cell: ({ getValue }: CellContext<OutboundDomainRow, unknown>) => {
			const v = getValue();
			const n = typeof v === "number" ? v : 0;
			return createMetricDisplay(n, "unique");
		},
	},
	{
		id: "unique_links",
		accessorKey: "unique_links",
		header: "Links",
		cell: ({ getValue }: CellContext<OutboundDomainRow, unknown>) => {
			const v = getValue();
			const n = typeof v === "number" ? v : 0;
			return createMetricDisplay(n, "unique");
		},
	},
	{
		id: "percentage",
		accessorKey: "percentage",
		header: "Share",
		cell: ({ getValue }: CellContext<OutboundDomainRow, unknown>) => {
			const v = getValue();
			const n = typeof v === "number" ? v : 0;
			return createPercentageBadge(n);
		},
	},
];

function isOutboundLinkRecord(value: unknown): value is Record<string, unknown> & {
	href: string;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		"href" in value &&
		typeof (value as { href: unknown }).href === "string"
	);
}

function isOutboundDomainRecord(value: unknown): value is Record<
	string,
	unknown
> & {
	domain: string;
} {
	return (
		typeof value === "object" &&
		value !== null &&
		"domain" in value &&
		typeof (value as { domain: unknown }).domain === "string"
	);
}

function toOutboundLinkRow(link: Record<string, unknown> & { href: string }): OutboundLinkRow {
	return {
		name: link.href,
		href: link.href,
		text: typeof link.text === "string" ? link.text : "",
		total_clicks: typeof link.total_clicks === "number" ? link.total_clicks : 0,
		unique_users: typeof link.unique_users === "number" ? link.unique_users : 0,
		unique_sessions:
			typeof link.unique_sessions === "number" ? link.unique_sessions : 0,
		percentage: typeof link.percentage === "number" ? link.percentage : 0,
	};
}

function toOutboundDomainRow(
	row: Record<string, unknown> & { domain: string }
): OutboundDomainRow {
	return {
		name: row.domain,
		domain: row.domain,
		total_clicks: typeof row.total_clicks === "number" ? row.total_clicks : 0,
		unique_users: typeof row.unique_users === "number" ? row.unique_users : 0,
		unique_links: typeof row.unique_links === "number" ? row.unique_links : 0,
		percentage: typeof row.percentage === "number" ? row.percentage : 0,
	};
}

export function OutboundLinksSection({
	data,
	isLoading,
	onAddFilterAction,
}: OutboundLinksSectionProps) {
	const linkRows = useMemo((): OutboundLinkRow[] => {
		const raw = data.outbound_links || [];
		return raw.filter(isOutboundLinkRecord).map(toOutboundLinkRow);
	}, [data.outbound_links]);

	const domainRows = useMemo((): OutboundDomainRow[] => {
		const raw = data.outbound_domains || [];
		return raw.filter(isOutboundDomainRecord).map(toOutboundDomainRow);
	}, [data.outbound_domains]);

	const eventsAndLinksTabs = useMemo((): TabConfig<OutboundLinkRow>[] => {
		return [
			{
				id: "outbound_links",
				label: "Outbound Links",
				data: linkRows,
				columns: outboundLinksColumns,
				getFilter: (row: OutboundLinkRow) => ({
					field: "href",
					value: row.href,
				}),
			},
			{
				id: "outbound_domains",
				label: "Outbound Domains",
				data: domainRows as unknown as OutboundLinkRow[],
				columns:
					outboundDomainsColumns as ColumnDef<OutboundLinkRow, unknown>[],
				getFilter: (row: OutboundLinkRow) => ({
					field: "href",
					value: `*${(row as unknown as OutboundDomainRow).domain}*`,
				}),
			},
		];
	}, [linkRows, domainRows]);

	return (
		<DataTable
			description="Interactions and outbound link tracking"
			isLoading={isLoading}
			minHeight="350px"
			onAddFilter={onAddFilterAction}
			tabs={eventsAndLinksTabs}
			title="Events & Links"
		/>
	);
}
