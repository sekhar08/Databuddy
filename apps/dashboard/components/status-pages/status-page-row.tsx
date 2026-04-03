"use client";

import {
	ArrowSquareOutIcon,
	BrowserIcon,
	CopyIcon,
	DotsThreeIcon,
	HeartbeatIcon,
	PencilSimpleIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useCallback } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { List } from "@/components/ui/composables/list";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatusPageUrl } from "@/lib/app-url";
import { cn } from "@/lib/utils";

export interface StatusPage {
	id: string;
	organizationId: string;
	slug: string;
	name: string;
	description: string | null;
	monitorCount: number;
	createdAt: Date | string;
	updatedAt: Date | string;
}

interface StatusPageRowProps {
	statusPage: StatusPage;
	onEditAction: () => void;
	onDeleteAction: () => void;
}

function StatusPageActions({
	statusPage,
	onEditAction,
	onDeleteAction,
}: StatusPageRowProps) {
	const url = getStatusPageUrl(statusPage.slug);

	const handleCopyUrl = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(url);
			toast.success("URL copied to clipboard");
		} catch {
			toast.error("Failed to copy URL");
		}
	}, [url]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					aria-label="Status page actions"
					className="size-8 opacity-50 hover:opacity-100 data-[state=open]:opacity-100"
					data-dropdown-trigger
					size="icon"
					variant="ghost"
				>
					<DotsThreeIcon className="size-5" weight="bold" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-48">
				<DropdownMenuItem asChild>
					<Link
						className="gap-2"
						href={`/monitors/status-pages/${statusPage.id}`}
					>
						<PencilSimpleIcon className="size-4" weight="duotone" />
						Manage Monitors
					</Link>
				</DropdownMenuItem>
				<DropdownMenuItem className="gap-2" onClick={onEditAction}>
					<PencilSimpleIcon className="size-4" weight="duotone" />
					Edit Details
				</DropdownMenuItem>
				<DropdownMenuItem className="gap-2" onClick={handleCopyUrl}>
					<CopyIcon className="size-4" weight="duotone" />
					Copy URL
				</DropdownMenuItem>
				<DropdownMenuItem asChild>
					<Link
						className="gap-2"
						href={url}
						rel="noopener noreferrer"
						target="_blank"
					>
						<ArrowSquareOutIcon className="size-4" weight="duotone" />
						View Page
					</Link>
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive"
					onClick={onDeleteAction}
				>
					<TrashIcon className="size-4" weight="duotone" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function StatusPageRow({
	statusPage,
	onEditAction,
	onDeleteAction,
}: StatusPageRowProps) {
	const hasMonitors = statusPage.monitorCount > 0;

	const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
		const target = e.target as HTMLElement;
		if (
			target.closest("[data-dropdown-trigger]") ||
			target.closest("[data-radix-popper-content-wrapper]") ||
			target.closest("a[target='_blank']")
		) {
			e.preventDefault();
		}
	};

	return (
		<List.Row asChild className="py-4">
			<Link
				href={`/monitors/status-pages/${statusPage.id}`}
				onClick={handleClick}
			>
				<List.Cell>
					<div
						className={cn(
							"flex size-10 items-center justify-center rounded",
							hasMonitors
								? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
								: "bg-muted text-muted-foreground"
						)}
					>
						<BrowserIcon className="size-5" weight="duotone" />
					</div>
				</List.Cell>

				<List.Cell className="w-48 min-w-0 flex-col gap-0.5 lg:w-60">
					<p className="wrap-break-word text-pretty font-medium text-foreground text-sm">
						{statusPage.name}
					</p>
					<p className="truncate text-muted-foreground text-xs">
						/{statusPage.slug}
					</p>
				</List.Cell>

				<List.Cell className="hidden md:flex" grow>
					{statusPage.description ? (
						<p className="line-clamp-2 text-muted-foreground text-xs leading-relaxed">
							{statusPage.description}
						</p>
					) : (
						<p className="text-muted-foreground/50 text-xs italic">
							No description
						</p>
					)}
				</List.Cell>

				<List.Cell className="hidden w-28 gap-1.5 lg:flex">
					<HeartbeatIcon
						className="size-3.5 text-muted-foreground"
						weight="duotone"
					/>
					<span className="text-muted-foreground text-xs tabular-nums">
						{statusPage.monitorCount}{" "}
						{statusPage.monitorCount === 1 ? "monitor" : "monitors"}
					</span>
				</List.Cell>

				<List.Cell className="w-20">
					<Badge
						className="shrink-0"
						variant={hasMonitors ? "green" : "secondary"}
					>
						{hasMonitors ? "Active" : "Empty"}
					</Badge>
				</List.Cell>

				<List.Cell action>
					<StatusPageActions
						onDeleteAction={onDeleteAction}
						onEditAction={onEditAction}
						statusPage={statusPage}
					/>
				</List.Cell>
			</Link>
		</List.Row>
	);
}

export function StatusPageRowSkeleton() {
	return (
		<div className="flex items-center gap-4 border-border/80 border-b px-4 py-4 last:border-b-0">
			<Skeleton className="size-10 shrink-0 rounded" />
			<div className="flex w-48 min-w-0 flex-col gap-1.5 lg:w-60">
				<Skeleton className="h-4 w-32 rounded" />
				<Skeleton className="h-3 w-20 rounded" />
			</div>
			<Skeleton className="hidden h-3 min-w-0 flex-1 md:block" />
			<Skeleton className="hidden h-3 w-20 lg:block" />
			<Skeleton className="h-5 w-16 rounded-full" />
		</div>
	);
}
