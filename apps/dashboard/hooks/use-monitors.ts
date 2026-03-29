"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/orpc";

export function useMonitorsLight(options?: { enabled?: boolean }) {
	const query = useQuery({
		...orpc.uptime.listSchedules.queryOptions({ input: {} }),
		enabled: options?.enabled !== false,
		staleTime: 5 * 60 * 1000,
	});

	return {
		monitors: query.data ?? [],
		isLoading: query.isLoading,
	};
}

export type MonitorLight = ReturnType<
	typeof useMonitorsLight
>["monitors"][number];
