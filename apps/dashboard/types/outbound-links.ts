export type OutboundLinkRow = {
	name: string;
	href: string;
	text: string;
	total_clicks: number;
	unique_users: number;
	unique_sessions: number;
	percentage: number;
};

export type OutboundDomainRow = {
	name: string;
	domain: string;
	total_clicks: number;
	unique_users: number;
	unique_links: number;
	percentage: number;
};

export type OutboundLinksSectionData = {
	outbound_links: unknown[];
	outbound_domains: unknown[];
};

export type OutboundLinksSectionProps = {
	data: OutboundLinksSectionData;
	isLoading: boolean;
	onAddFilterAction: (field: string, value: string) => void;
};
