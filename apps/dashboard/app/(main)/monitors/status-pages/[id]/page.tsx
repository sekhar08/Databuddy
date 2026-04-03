"use client";

import {
	ArrowClockwiseIcon,
	BrowserIcon,
	CheckIcon,
	HeartbeatIcon,
	PencilSimpleIcon,
	PlusIcon,
	SirenIcon,
	TrashIcon,
	XIcon,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/app/(main)/websites/_components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ErrorBoundary } from "@/components/error-boundary";
import { FeatureAccessGate } from "@/components/feature-access-gate";
import { PageNavigation } from "@/components/layout/page-navigation";
import { useOrganizationsContext } from "@/components/providers/organizations-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { List } from "@/components/ui/composables/list";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getStatusPageUrl } from "@/lib/app-url";
import { orpc } from "@/lib/orpc";
import { cn } from "@/lib/utils";

function AddMonitorDialog({
	statusPageId,
	existingMonitorIds,
	open,
	onOpenChange,
	onAddComplete,
}: {
	statusPageId: string;
	existingMonitorIds: string[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAddComplete: () => void;
}) {
	const { activeOrganizationId, activeOrganization } =
		useOrganizationsContext();
	const resolvedOrgId = activeOrganization?.id ?? activeOrganizationId ?? "";

	const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");

	const schedulesQuery = useQuery({
		...orpc.uptime.listSchedules.queryOptions({
			input: { organizationId: resolvedOrgId },
		}),
		enabled: open && !!resolvedOrgId,
	});

	const addMutation = useMutation({
		...orpc.statusPage.addMonitor.mutationOptions(),
	});

	const availableSchedules =
		schedulesQuery.data?.filter((s) => !existingMonitorIds.includes(s.id)) ||
		[];

	const handleAdd = async () => {
		if (!selectedScheduleId) {
			return;
		}

		try {
			await addMutation.mutateAsync({
				statusPageId,
				uptimeScheduleId: selectedScheduleId,
			});
			toast.success("Monitor added to status page");
			onAddComplete();
			onOpenChange(false);
			setSelectedScheduleId("");
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Failed to add monitor";
			toast.error(errorMessage);
		}
	};

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add Monitor</DialogTitle>
					<DialogDescription>
						Select an existing uptime monitor to display on this status page.
					</DialogDescription>
				</DialogHeader>

				<div className="py-4">
					<Label className="mb-2 block">Monitor</Label>
					<Select
						disabled={schedulesQuery.isLoading}
						onValueChange={setSelectedScheduleId}
						value={selectedScheduleId}
					>
						<SelectTrigger>
							<SelectValue placeholder="Select a monitor..." />
						</SelectTrigger>
						<SelectContent>
							{availableSchedules.length === 0 ? (
								<SelectItem disabled value="empty">
									No available monitors
								</SelectItem>
							) : (
								availableSchedules.map((schedule) => (
									<SelectItem key={schedule.id} value={schedule.id}>
										{schedule.name || schedule.url}
									</SelectItem>
								))
							)}
						</SelectContent>
					</Select>
				</div>

				<DialogFooter>
					<Button onClick={() => onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button
						disabled={!selectedScheduleId || addMutation.isPending}
						onClick={handleAdd}
					>
						{addMutation.isPending ? "Adding..." : "Add Monitor"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

type ToggleKey = "hideUrl" | "hideUptimePercentage" | "hideLatency";

interface StatusPageMonitor {
	id: string;
	statusPageId: string;
	uptimeScheduleId: string;
	displayName: string | null;
	hideUrl: boolean;
	hideUptimePercentage: boolean;
	hideLatency: boolean;
	uptimeSchedule: {
		id: string;
		name: string | null;
		url: string | null;
		isPaused: boolean;
	};
}

function StatusPageMonitorRow({
	monitor,
	statusPageId,
	onRemoveRequestAction,
}: {
	monitor: StatusPageMonitor;
	statusPageId: string;
	onRemoveRequestAction: (monitorId: string) => void;
}) {
	const queryClient = useQueryClient();
	const queryKey = orpc.statusPage.get.queryOptions({
		input: { statusPageId },
	}).queryKey;

	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	const updateSettingsMutation = useMutation({
		...orpc.statusPage.updateMonitorSettings.mutationOptions(),
	});

	const schedule = monitor.uptimeSchedule;
	const isPaused = schedule.isPaused;
	const resolvedName =
		monitor.displayName || schedule.name || schedule.url || "Unnamed";

	const optimisticUpdate = (
		patch: Partial<StatusPageMonitor>,
		rollbackData: typeof queryClient extends {
			getQueryData: (k: typeof queryKey) => infer R;
		}
			? R
			: never
	) => {
		queryClient.setQueryData(queryKey, (old: typeof rollbackData) => {
			if (!old) {
				return old;
			}
			return {
				...old,
				monitors: old.monitors.map((m: StatusPageMonitor) =>
					m.id === monitor.id ? { ...m, ...patch } : m
				),
			};
		});
	};

	const handleToggle = async (key: ToggleKey, value: boolean) => {
		const previous = queryClient.getQueryData(queryKey);
		optimisticUpdate({ [key]: value } as Partial<StatusPageMonitor>, previous);

		try {
			await updateSettingsMutation.mutateAsync({
				monitorId: monitor.id,
				[key]: value,
			});
		} catch {
			queryClient.setQueryData(queryKey, previous);
			toast.error("Failed to update setting");
		}
	};

	const startEditing = () => {
		setEditValue(monitor.displayName ?? "");
		setIsEditing(true);
		requestAnimationFrame(() => inputRef.current?.focus());
	};

	const cancelEditing = () => {
		setIsEditing(false);
		setEditValue("");
	};

	const saveDisplayName = async () => {
		const trimmed = editValue.trim();
		const newName = trimmed === "" ? null : trimmed;

		if (newName === monitor.displayName) {
			cancelEditing();
			return;
		}

		const previous = queryClient.getQueryData(queryKey);
		optimisticUpdate({ displayName: newName }, previous);
		setIsEditing(false);

		try {
			await updateSettingsMutation.mutateAsync({
				monitorId: monitor.id,
				displayName: newName,
			});
		} catch {
			queryClient.setQueryData(queryKey, previous);
			toast.error("Failed to rename monitor");
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			e.preventDefault();
			saveDisplayName();
		}
		if (e.key === "Escape") {
			cancelEditing();
		}
	};

	return (
		<List.Row className={cn(isPaused && "opacity-50")}>
			<List.Cell>
				<div
					className={cn(
						"flex size-8 items-center justify-center rounded",
						isPaused
							? "bg-muted text-muted-foreground"
							: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
					)}
				>
					<HeartbeatIcon className="size-4" weight="duotone" />
				</div>
			</List.Cell>

			<List.Cell className="w-40 min-w-0 lg:w-52">
				{isEditing ? (
					<div className="flex items-center gap-1">
						<input
							className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-2 font-medium text-foreground text-sm outline-none focus:ring-1 focus:ring-ring"
							onBlur={saveDisplayName}
							onChange={(e) => setEditValue(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder={schedule.name || schedule.url || "Display name"}
							ref={inputRef}
							type="text"
							value={editValue}
						/>
						<Button
							aria-label="Save name"
							className="size-6 shrink-0"
							onClick={saveDisplayName}
							size="icon"
							variant="ghost"
						>
							<CheckIcon className="size-3.5" />
						</Button>
						<Button
							aria-label="Cancel editing"
							className="size-6 shrink-0"
							onClick={cancelEditing}
							onMouseDown={(e) => e.preventDefault()}
							size="icon"
							variant="ghost"
						>
							<XIcon className="size-3.5" />
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-1.5">
						<div className="flex min-w-0 items-center gap-2">
							<p className="truncate font-medium text-foreground text-sm">
								{resolvedName}
							</p>
							{monitor.displayName && (
								<span className="hidden shrink-0 text-muted-foreground/60 text-xs lg:inline">
									({schedule.name || schedule.url})
								</span>
							)}
							{isPaused && (
								<Badge className="shrink-0" variant="amber">
									Paused
								</Badge>
							)}
						</div>
						<Button
							aria-label="Rename monitor"
							className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
							onClick={(e) => {
								e.preventDefault();
								startEditing();
							}}
							size="icon"
							variant="ghost"
						>
							<PencilSimpleIcon className="size-3.5" weight="duotone" />
						</Button>
					</div>
				)}
			</List.Cell>

			<List.Cell grow>
				<p className="wrap-break-word text-pretty text-muted-foreground text-xs">
					{schedule.url}
				</p>
			</List.Cell>

			<List.Cell className="hidden items-center gap-5 lg:flex">
				<div className="flex items-center gap-2">
					<Switch
						checked={monitor.hideUrl}
						id={`hide-url-${monitor.id}`}
						onCheckedChange={(v) => handleToggle("hideUrl", v)}
					/>
					<Label
						className="cursor-pointer font-normal text-muted-foreground text-xs"
						htmlFor={`hide-url-${monitor.id}`}
					>
						Hide URL
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<Switch
						checked={monitor.hideUptimePercentage}
						id={`hide-uptime-${monitor.id}`}
						onCheckedChange={(v) => handleToggle("hideUptimePercentage", v)}
					/>
					<Label
						className="cursor-pointer font-normal text-muted-foreground text-xs"
						htmlFor={`hide-uptime-${monitor.id}`}
					>
						Hide Uptime
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<Switch
						checked={monitor.hideLatency}
						id={`hide-latency-${monitor.id}`}
						onCheckedChange={(v) => handleToggle("hideLatency", v)}
					/>
					<Label
						className="cursor-pointer font-normal text-muted-foreground text-xs"
						htmlFor={`hide-latency-${monitor.id}`}
					>
						Hide Latency
					</Label>
				</div>
			</List.Cell>

			<List.Cell action>
				<Button
					aria-label="Remove monitor"
					className="text-destructive hover:bg-destructive/10 hover:text-destructive"
					onClick={(e) => {
						e.preventDefault();
						onRemoveRequestAction(monitor.id);
					}}
					size="icon"
					variant="ghost"
				>
					<TrashIcon className="size-4" weight="duotone" />
				</Button>
			</List.Cell>
		</List.Row>
	);
}

export default function StatusPageDetailsPage() {
	const params = useParams();
	const statusPageId = params.id as string;
	const queryClient = useQueryClient();
	const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
	const [monitorToRemove, setMonitorToRemove] = useState<string | null>(null);

	const statusPageQuery = useQuery({
		...orpc.statusPage.get.queryOptions({ input: { statusPageId } }),
		enabled: !!statusPageId,
	});

	const removeMutation = useMutation({
		...orpc.statusPage.removeMonitor.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: orpc.statusPage.get.key({ input: { statusPageId } }),
			});
			toast.success("Monitor removed");
			setMonitorToRemove(null);
		},
	});

	const statusPage = statusPageQuery.data;

	const monitorToRemoveData = statusPage?.monitors.find(
		(m: (typeof statusPage.monitors)[number]) => m.id === monitorToRemove
	);

	const handleConfirmRemove = () => {
		if (!monitorToRemoveData) {
			return;
		}
		removeMutation.mutate({
			statusPageId: monitorToRemoveData.statusPageId,
			uptimeScheduleId: monitorToRemoveData.uptimeScheduleId,
		});
	};

	return (
		<ErrorBoundary>
			<div className="flex h-full min-h-0 flex-col">
				<PageHeader
					description={
						statusPage
							? `Manage monitors for ${statusPage.name}`
							: "Manage status page monitors"
					}
					icon={<BrowserIcon />}
					right={
						statusPage && (
							<>
								<Button asChild size="sm" variant="outline">
									<Link
										href={getStatusPageUrl(statusPage.slug)}
										rel="noopener noreferrer"
										target="_blank"
									>
										View Page
									</Link>
								</Button>
								<Button
									aria-label="Refresh data"
									disabled={
										statusPageQuery.isLoading || statusPageQuery.isFetching
									}
									onClick={() => statusPageQuery.refetch()}
									size="icon"
									variant="outline"
								>
									<ArrowClockwiseIcon
										className={cn(
											(statusPageQuery.isLoading ||
												statusPageQuery.isFetching) &&
												"animate-spin"
										)}
									/>
								</Button>
								<Button onClick={() => setIsAddDialogOpen(true)} size="sm">
									<PlusIcon />
									Add Monitor
								</Button>
							</>
						)
					}
					title={statusPage?.name ?? "Status Page"}
				/>

				<PageNavigation
					breadcrumb={{ label: "Status Pages", href: "/monitors/status-pages" }}
					currentPage={statusPage?.name ?? "Loading..."}
					variant="breadcrumb"
				/>

			<FeatureAccessGate
				flagKey="monitors"
				loadingFallback={<List.DefaultLoading />}
			>
			<Tabs
				className="flex min-h-0 flex-1 flex-col gap-0"
				defaultValue="monitors"
				variant="navigation"
			>
					<TabsList>
						<TabsTrigger value="monitors">
							<HeartbeatIcon size={16} weight="duotone" />
							Monitors
						</TabsTrigger>
						<TabsTrigger disabled value="incidents">
							<SirenIcon size={16} weight="duotone" />
							Incidents
							<Badge className="px-1.5 py-0" variant="secondary">
								Soon
							</Badge>
						</TabsTrigger>
					</TabsList>

					<TabsContent
						className="min-h-0 flex-1 overflow-y-auto"
						value="monitors"
					>
						{statusPageQuery.isLoading ? (
							<List.DefaultLoading />
						) : statusPageQuery.isError ? (
							<div className="flex flex-1 items-center justify-center py-16">
								<EmptyState
									action={{
										label: "Retry",
										onClick: () => statusPageQuery.refetch(),
									}}
									description="Something went wrong while loading the status page."
									icon={<BrowserIcon weight="duotone" />}
									title="Failed to load"
									variant="error"
								/>
							</div>
						) : statusPage?.monitors.length === 0 ? (
							<div className="flex flex-1 items-center justify-center py-16">
								<EmptyState
									action={{
										label: "Add Monitor",
										onClick: () => setIsAddDialogOpen(true),
									}}
									description="Add monitors to this status page to display their uptime and latency."
									icon={<HeartbeatIcon weight="duotone" />}
									title="No monitors added"
									variant="minimal"
								/>
							</div>
						) : (
							<List className="rounded bg-card">
								{statusPage?.monitors.map(
									(monitor: (typeof statusPage.monitors)[number]) => (
										<StatusPageMonitorRow
											key={monitor.id}
											monitor={monitor}
											onRemoveRequestAction={(id) => setMonitorToRemove(id)}
											statusPageId={statusPageId}
										/>
									)
								)}
							</List>
						)}
					</TabsContent>

					<TabsContent
						className="min-h-0 flex-1 overflow-y-auto"
						value="incidents"
					>
						<div className="flex flex-1 items-center justify-center py-16">
							<EmptyState
								description="Incident management is coming soon. You'll be able to create and track incidents directly from here."
								icon={<SirenIcon weight="duotone" />}
								showPlusBadge={false}
								title="Coming Soon"
								variant="minimal"
							/>
						</div>
					</TabsContent>
				</Tabs>
			</FeatureAccessGate>

				<AddMonitorDialog
					existingMonitorIds={
						statusPage?.monitors.map(
							(m: (typeof statusPage.monitors)[number]) => m.uptimeScheduleId
						) || []
					}
					onAddComplete={() => statusPageQuery.refetch()}
					onOpenChange={setIsAddDialogOpen}
					open={isAddDialogOpen}
					statusPageId={statusPageId}
				/>

				<DeleteDialog
					confirmLabel="Remove"
					description="This monitor will no longer appear on the public status page."
					isDeleting={removeMutation.isPending}
					isOpen={monitorToRemove !== null}
					itemName={
						monitorToRemoveData?.uptimeSchedule.name ??
						monitorToRemoveData?.uptimeSchedule.url ??
						undefined
					}
					onClose={() => setMonitorToRemove(null)}
					onConfirm={handleConfirmRemove}
					title="Remove Monitor"
				/>
			</div>
		</ErrorBoundary>
	);
}
