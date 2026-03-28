type Input = Record<string, unknown>;

const QUERY_LABELS: Record<string, string> = {
	traffic: "traffic",
	sessions: "sessions",
	devices: "devices",
	browsers: "browsers",
	os: "operating systems",
	countries: "geo data",
	cities: "cities",
	regions: "regions",
	pages: "pages",
	referrers: "referrers",
	sources: "traffic sources",
	utm: "UTM parameters",
	events: "events",
	custom_events: "custom events",
	vitals: "web vitals",
	performance: "performance",
	errors: "errors",
	summary: "summary",
	engagement: "engagement",
	profiles: "profiles",
	llm_analytics: "LLM analytics",
	uptime: "uptime",
	links: "links",
};

function queryLabel(input: Input): string {
	const type = input.type as string | undefined;
	const label = type
		? (QUERY_LABELS[type] ?? type.replace(/_/g, " "))
		: "analytics";
	return `Querying ${label}`;
}

function confirmLabel(input: Input, pending: string, active: string): string {
	return input.confirmed === true ? active : pending;
}

function crudLabel(
	entity: string
): (action: string) => (input: Input) => string {
	return (action) => (input) => {
		const pendingMap: Record<string, string> = {
			create: `Preparing ${entity}`,
			update: `Preparing ${entity} update`,
			delete: `Preparing ${entity} deletion`,
		};
		const activeMap: Record<string, string> = {
			create: `Creating ${entity}`,
			update: `Updating ${entity}`,
			delete: `Deleting ${entity}`,
		};
		return confirmLabel(
			input,
			pendingMap[action] ?? `Processing ${entity}`,
			activeMap[action] ?? `Processing ${entity}`
		);
	};
}

const TOOL_LABELS: Record<string, (input: Input) => string> = {
	execute_query_builder: queryLabel,
	execute_sql_query: () => "Running custom query",
	get_top_pages: () => "Getting top pages",
	get_data: (input) => {
		const queries = input.queries as { type: string }[] | undefined;
		if (queries?.length) {
			const types = queries
				.map((q) => QUERY_LABELS[q.type] ?? (q.type ?? "").replace(/_/g, " "))
				.slice(0, 3)
				.join(", ");
			return `Querying ${types}`;
		}
		return "Fetching analytics";
	},

	list_links: () => "Fetching links",
	get_link: () => "Getting link details",
	create_link: crudLabel("link")("create"),
	update_link: crudLabel("link")("update"),
	delete_link: crudLabel("link")("delete"),
	search_links: () => "Searching links",

	list_funnels: () => "Fetching funnels",
	get_funnel_by_id: () => "Getting funnel details",
	get_funnel_analytics: () => "Analyzing funnel",
	get_funnel_analytics_by_referrer: () => "Analyzing funnel by source",
	create_funnel: crudLabel("funnel")("create"),
	update_funnel: crudLabel("funnel")("update"),
	delete_funnel: crudLabel("funnel")("delete"),

	list_goals: () => "Fetching goals",
	get_goal_by_id: () => "Getting goal details",
	get_goal_analytics: () => "Analyzing goal",
	create_goal: crudLabel("goal")("create"),
	update_goal: crudLabel("goal")("update"),
	delete_goal: crudLabel("goal")("delete"),

	list_annotations: () => "Fetching annotations",
	get_annotation_by_id: () => "Getting annotation",
	create_annotation: crudLabel("annotation")("create"),
	update_annotation: crudLabel("annotation")("update"),
	delete_annotation: crudLabel("annotation")("delete"),

	list_profiles: () => "Listing visitors",
	get_profile: () => "Getting visitor profile",
	get_profile_sessions: () => "Loading visitor sessions",

	web_search: (input) => {
		const query = input.query as string | undefined;
		return query ? `Searching: ${query.slice(0, 40)}` : "Searching the web";
	},
	x_search: (input) => {
		const query = input.query as string | undefined;
		return query
			? `Searching X: ${query.slice(0, 40)}`
			: "Searching X (Twitter)";
	},

	competitor_analysis: () => "Analyzing competitors",

	save_memory: () => "Saving memory",
	recall_memories: () => "Recalling memories",
	list_memories: () => "Loading memories",
	delete_memory: () => "Deleting memory",
};

export function formatToolLabel(toolName: string, input: Input): string {
	const labelFn = TOOL_LABELS[toolName];
	return labelFn ? labelFn(input) : "Processing";
}
