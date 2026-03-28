"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function MonitorDetailLoading() {
	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="flex min-h-[88px] shrink-0 items-center gap-3 border-b p-3 sm:p-4">
				<Skeleton className="size-12 shrink-0 rounded" />
				<div className="min-w-0 flex-1 space-y-2">
					<Skeleton className="h-7 w-52 max-w-[70%] rounded sm:h-8" />
					<Skeleton className="h-4 w-full max-w-lg rounded" />
				</div>
				<div className="hidden shrink-0 flex-wrap items-center justify-end gap-2 sm:flex">
					<Skeleton className="h-9 w-18 rounded" />
					<Skeleton className="size-9 rounded" />
					<Skeleton className="h-9 w-24 rounded" />
					<Skeleton className="h-9 w-20 rounded" />
					<Skeleton className="h-9 w-24 rounded" />
					<Skeleton className="h-9 w-20 rounded" />
				</div>
			</div>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div className="shrink-0 border-b bg-card px-4 py-4 sm:px-6">
					<dl className="grid min-h-[5.25rem] gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{["a", "b", "c", "d"].map((key) => (
							<div key={key}>
								<Skeleton className="mb-2 h-3 w-16 rounded" />
								<Skeleton className="h-6 w-28 rounded" />
							</div>
						))}
					</dl>
				</div>

				<div className="shrink-0 border-b bg-sidebar">
					<div className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
						<Skeleton className="h-5 w-36 rounded" />
						<Skeleton className="h-4 w-32 rounded" />
					</div>
					<div className="p-4">
						<div className="flex h-16 w-full gap-px sm:gap-1">
							{Array.from({ length: 24 }).map((_, i) => (
								<Skeleton
									className="h-full min-w-0 flex-1 rounded-sm"
									key={`h-${i}`}
								/>
							))}
						</div>
						<div className="mt-2 flex justify-between">
							<Skeleton className="h-3 w-16 rounded" />
							<Skeleton className="h-3 w-12 rounded" />
						</div>
					</div>
				</div>

				<div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-sidebar">
					<div className="min-h-0 flex-1 overflow-y-auto">
						<div className="border-b px-4 py-3 sm:px-6">
							<Skeleton className="h-5 w-40 rounded" />
						</div>
						<div className="bg-card">
							<div className="border-b px-3 py-2">
								<div className="flex gap-4">
									<Skeleton className="h-4 w-14 rounded" />
									<Skeleton className="h-4 w-12 rounded" />
									<Skeleton className="h-4 w-16 rounded" />
									<Skeleton className="h-4 w-10 rounded" />
									<Skeleton className="h-4 w-16 rounded" />
								</div>
							</div>
							<div className="divide-y">
								{Array.from({ length: 8 }).map((_, i) => (
									<div
										className="flex items-center gap-3 px-3 py-3"
										key={`r-${i}`}
									>
										<Skeleton className="size-4 shrink-0 rounded" />
										<Skeleton className="h-4 w-24 rounded" />
										<Skeleton className="ml-auto h-4 w-28 rounded sm:ml-0" />
										<Skeleton className="hidden h-5 w-14 rounded sm:block" />
										<Skeleton className="hidden h-4 w-24 rounded md:block" />
										<Skeleton className="hidden h-4 w-12 rounded lg:block" />
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
