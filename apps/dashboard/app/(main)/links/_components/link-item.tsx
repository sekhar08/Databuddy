"use client";

import {
	AndroidLogoIcon,
	AppleLogoIcon,
	ClockCountdownIcon,
	CopyIcon,
	DotsThreeIcon,
	HashIcon,
	ImageIcon,
	LinkIcon,
	PencilSimpleIcon,
	QrCodeIcon,
	TrashIcon,
} from "@phosphor-icons/react";
import NextLink from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Link } from "@/hooks/use-links";
import { fromNow, localDayjs } from "@/lib/time";
import { cn } from "@/lib/utils";

const LINKS_BASE_URL = "https://dby.sh";

function formatTarget(targetUrl: string): string {
	try {
		const parsed = new URL(targetUrl);
		return parsed.host + (parsed.pathname !== "/" ? parsed.pathname : "");
	} catch {
		return targetUrl;
	}
}

function LinkActions({
	link,
	onEdit,
	onDelete,
	onShowQr,
}: {
	link: Link;
	onEdit: (link: Link) => void;
	onDelete: (linkId: string) => void;
	onShowQr: (link: Link) => void;
}) {
	const handleCopy = () => {
		navigator.clipboard
			.writeText(`${LINKS_BASE_URL}/${link.slug}`)
			.then(() => toast.success("Copied to clipboard"))
			.catch(() => toast.error("Failed to copy"));
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					aria-label="Link actions"
					className="size-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
					size="icon"
					variant="ghost"
				>
					<DotsThreeIcon className="size-4" weight="bold" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-40">
				<DropdownMenuItem className="gap-2" onClick={handleCopy}>
					<CopyIcon className="size-4" weight="duotone" />
					Copy URL
				</DropdownMenuItem>
				<DropdownMenuItem className="gap-2" onClick={() => onShowQr(link)}>
					<QrCodeIcon className="size-4" weight="duotone" />
					QR Code
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem className="gap-2" onClick={() => onEdit(link)}>
					<PencilSimpleIcon className="size-4" weight="duotone" />
					Edit
				</DropdownMenuItem>
				<DropdownMenuSeparator />
				<DropdownMenuItem
					className="gap-2 text-destructive focus:text-destructive"
					onClick={() => onDelete(link.id)}
					variant="destructive"
				>
					<TrashIcon className="size-4" weight="duotone" />
					Delete
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function shortenId(id: string): string {
	if (id.length <= 8) {
		return id;
	}
	return `${id.slice(0, 3)}…${id.slice(-3)}`;
}

function shortenUrl(url: string): string {
	try {
		return new URL(url).host;
	} catch {
		return url.length <= 12 ? url : `${url.slice(0, 9)}…`;
	}
}

function LinkIndicators({ link }: { link: Link }) {
	const hasOg = Boolean(link.ogTitle ?? link.ogDescription ?? link.ogImageUrl);
	const hasIos = Boolean(link.iosUrl);
	const hasAndroid = Boolean(link.androidUrl);

	const isExpired =
		link.expiresAt && localDayjs(link.expiresAt).isBefore(localDayjs());
	const isExpiringSoon =
		link.expiresAt &&
		!isExpired &&
		localDayjs(link.expiresAt).isBefore(localDayjs().add(7, "day"));

	const tags: Array<{
		key: string;
		icon: React.ReactNode;
		text: string;
		tooltip?: string;
		className?: string;
	}> = [];

	if (isExpired) {
		tags.push({
			key: "expired",
			icon: <ClockCountdownIcon className="size-3.5" weight="duotone" />,
			text: "Expired",
			className: "text-destructive",
		});
	} else if (isExpiringSoon && link.expiresAt) {
		tags.push({
			key: "expiring",
			icon: <ClockCountdownIcon className="size-3.5" weight="duotone" />,
			text: localDayjs(link.expiresAt).fromNow(true),
			tooltip: `Expires ${localDayjs(link.expiresAt).format("MMM D, YYYY")}`,
			className: "text-amber-500",
		});
	}

	if (link.externalId) {
		tags.push({
			key: "ext",
			icon: <HashIcon className="size-3.5" weight="duotone" />,
			text: shortenId(link.externalId),
			tooltip: link.externalId.length > 8 ? link.externalId : undefined,
		});
	}

	if (hasOg) {
		tags.push({
			key: "og",
			icon: <ImageIcon className="size-3.5" weight="duotone" />,
			text: "OG",
		});
	}

	if (hasIos && link.iosUrl) {
		tags.push({
			key: "ios",
			icon: <AppleLogoIcon className="size-3.5" weight="duotone" />,
			text: shortenUrl(link.iosUrl),
			tooltip: link.iosUrl,
		});
	}

	if (hasAndroid && link.androidUrl) {
		tags.push({
			key: "android",
			icon: <AndroidLogoIcon className="size-3.5" weight="duotone" />,
			text: shortenUrl(link.androidUrl),
			tooltip: link.androidUrl,
		});
	}

	if (tags.length === 0) {
		return null;
	}

	return (
		<div className="flex shrink-0 items-center gap-1.5">
			{tags.map((tag) => {
				const content = (
					<span
						className={cn(
							"flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs",
							tag.className
						)}
					>
						{tag.icon}
						{tag.text}
					</span>
				);

				if (tag.tooltip) {
					return (
						<Tooltip delayDuration={200} key={tag.key}>
							<TooltipTrigger asChild>{content}</TooltipTrigger>
							<TooltipContent side="top">{tag.tooltip}</TooltipContent>
						</Tooltip>
					);
				}

				return <span key={tag.key}>{content}</span>;
			})}
		</div>
	);
}

function LinkRow({
	link,
	onEdit,
	onDelete,
	onShowQr,
}: {
	link: Link;
	onEdit: (link: Link) => void;
	onDelete: (linkId: string) => void;
	onShowQr: (link: Link) => void;
}) {
	const isExpired =
		link.expiresAt && localDayjs(link.expiresAt).isBefore(localDayjs());

	return (
		<NextLink
			className={cn(
				"group flex h-20 w-full items-center gap-4 border-b px-4 transition-colors hover:bg-accent/50",
				isExpired && "opacity-50"
			)}
			href={`/links/${link.id}`}
		>
			<div className="shrink-0 rounded bg-accent p-2 text-blue-500">
				<LinkIcon className="size-5" weight="duotone" />
			</div>

			<div className="min-w-0 flex-1 space-y-1">
				<div className="flex items-center gap-2">
					<span className="truncate font-medium text-[15px]">{link.name}</span>
					<LinkIndicators link={link} />
				</div>
				<p className="truncate text-muted-foreground text-sm">
					dby.sh/{link.slug}
					<span className="mx-1.5 text-muted-foreground/40">→</span>
					{formatTarget(link.targetUrl)}
				</p>
			</div>

			<span className="shrink-0 text-muted-foreground text-sm tabular-nums">
				{fromNow(link.createdAt)}
			</span>

			<div
				className="shrink-0"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
				}}
				onKeyDown={(e) => e.stopPropagation()}
				role="presentation"
			>
				<LinkActions
					link={link}
					onDelete={onDelete}
					onEdit={onEdit}
					onShowQr={onShowQr}
				/>
			</div>
		</NextLink>
	);
}

interface LinksListProps {
	links: Link[];
	onEdit: (link: Link) => void;
	onDelete: (linkId: string) => void;
	onShowQr: (link: Link) => void;
}

export function LinksList({
	links,
	onEdit,
	onDelete,
	onShowQr,
}: LinksListProps) {
	return (
		<div className="w-full">
			{links.map((link) => (
				<LinkRow
					key={link.id}
					link={link}
					onDelete={onDelete}
					onEdit={onEdit}
					onShowQr={onShowQr}
				/>
			))}
		</div>
	);
}

export function LinksListSkeleton() {
	return (
		<div className="w-full">
			{Array.from({ length: 5 }).map((_, i) => (
				<div
					className="flex h-20 items-center gap-4 border-b px-4"
					key={`skeleton-${i + 1}`}
				>
					<Skeleton className="size-9 shrink-0 rounded" />
					<div className="min-w-0 flex-1 space-y-2">
						<Skeleton className="h-5 w-36" />
						<Skeleton className="h-4 w-52" />
					</div>
					<Skeleton className="h-4 w-12 shrink-0" />
				</div>
			))}
		</div>
	);
}

export { LinkRow as LinkItem };
export function LinkItemSkeleton() {
	return (
		<div className="flex h-20 items-center gap-4 border-b px-4">
			<Skeleton className="size-9 shrink-0 rounded" />
			<div className="min-w-0 flex-1 space-y-2">
				<Skeleton className="h-5 w-36" />
				<Skeleton className="h-4 w-52" />
			</div>
			<Skeleton className="h-4 w-12 shrink-0" />
		</div>
	);
}
