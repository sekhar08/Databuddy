import { normalizePlans } from "@/app/(home)/pricing/_pricing/normalize";
import { RAW_PLANS } from "@/app/(home)/pricing/data";
import type { NormalizedPlan } from "@/app/(home)/pricing/_pricing/types";
import { estimateTieredOverageCostFromTiers } from "@/app/(home)/pricing/_pricing/estimator-utils";

const PLANS: NormalizedPlan[] = normalizePlans(RAW_PLANS);

function getDatabuddyMonthlyCost(monthlyEvents: number): {
	plan: NormalizedPlan;
	totalCost: number;
} {
	const paidPlans = PLANS.filter((p) => p.priceMonthly > 0 && p.eventTiers);

	let bestPlan = paidPlans.at(0);
	let bestCost = Number.POSITIVE_INFINITY;

	for (const plan of paidPlans) {
		const overage = Math.max(monthlyEvents - plan.includedEventsMonthly, 0);
		const overageCost =
			overage > 0 && plan.eventTiers
				? estimateTieredOverageCostFromTiers(overage, plan.eventTiers)
				: 0;
		const total = plan.priceMonthly + overageCost;
		if (total < bestCost) {
			bestCost = total;
			bestPlan = plan;
		}
	}

	return {
		plan: bestPlan as NormalizedPlan,
		totalCost: bestCost,
	};
}

export interface CalculatorInputs {
	monthlyVisitors: number;
	bannerBounceRate: number;
	conversionRate: number;
	revenuePerConversion: number;
}

export interface CalculatorOutputs {
	lostVisitors: number;
	lostConversions: number;
	lostRevenueMonthly: number;
	lostRevenueYearly: number;
	roiMultiplier: number;
	databuddyMonthlyCost: number;
	databuddyPlanName: string;
}

export function calculateCookieBannerCost(
	inputs: CalculatorInputs
): CalculatorOutputs {
	const lostVisitors = inputs.monthlyVisitors * inputs.bannerBounceRate;
	const lostConversions = lostVisitors * inputs.conversionRate;
	const lostRevenueMonthly = lostConversions * inputs.revenuePerConversion;
	const lostRevenueYearly = lostRevenueMonthly * 12;

	const { plan, totalCost } = getDatabuddyMonthlyCost(
		inputs.monthlyVisitors
	);
	const roiMultiplier =
		totalCost > 0 ? lostRevenueMonthly / totalCost : 0;

	return {
		lostVisitors,
		lostConversions,
		lostRevenueMonthly,
		lostRevenueYearly,
		roiMultiplier,
		databuddyMonthlyCost: totalCost,
		databuddyPlanName: plan.name,
	};
}

export interface Scenario {
	name: string;
	description: string;
	inputs: CalculatorInputs;
	outputs: CalculatorOutputs;
}

const SCENARIO_CONFIGS: Omit<Scenario, "outputs">[] = [
	{
		name: "Small Blog",
		description: "Content site with affiliate revenue",
		inputs: {
			monthlyVisitors: 5_000,
			bannerBounceRate: 0.09,
			conversionRate: 0.02,
			revenuePerConversion: 45,
		},
	},
	{
		name: "Growing Blog",
		description: "Established content site with courses",
		inputs: {
			monthlyVisitors: 25_000,
			bannerBounceRate: 0.09,
			conversionRate: 0.025,
			revenuePerConversion: 120,
		},
	},
	{
		name: "Growing SaaS",
		description: "B2B SaaS with trial-to-paid funnel",
		inputs: {
			monthlyVisitors: 25_000,
			bannerBounceRate: 0.12,
			conversionRate: 0.035,
			revenuePerConversion: 65,
		},
	},
	{
		name: "Mid-Traffic Site",
		description: "E-commerce or marketplace",
		inputs: {
			monthlyVisitors: 100_000,
			bannerBounceRate: 0.1,
			conversionRate: 0.03,
			revenuePerConversion: 85,
		},
	},
	{
		name: "High-Traffic App",
		description: "Large-scale SaaS or media platform",
		inputs: {
			monthlyVisitors: 500_000,
			bannerBounceRate: 0.11,
			conversionRate: 0.025,
			revenuePerConversion: 110,
		},
	},
];

export const SCENARIOS: Scenario[] = SCENARIO_CONFIGS.map((config) => ({
	...config,
	outputs: calculateCookieBannerCost(config.inputs),
}));

export function formatCurrency(value: number): string {
	if (value >= 1_000_000) {
		return `$${(value / 1_000_000).toFixed(1)}M`;
	}
	if (value >= 1_000) {
		return `$${(value / 1_000).toFixed(1)}K`;
	}
	return `$${Math.round(value).toLocaleString()}`;
}

export function formatCurrencyFull(value: number): string {
	return `$${Math.round(value).toLocaleString()}`;
}

export function formatNumber(value: number): string {
	return Math.round(value).toLocaleString();
}

export function formatPercent(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

export function formatMultiplier(value: number): string {
	if (value >= 1_000) {
		return `${(value / 1_000).toFixed(0)}K`;
	}
	return `${Math.round(value)}`;
}
