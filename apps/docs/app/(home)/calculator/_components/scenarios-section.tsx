"use client";

import { SciFiCard } from "@/components/scifi-card";
import { cn } from "@/lib/utils";
import {
	SCENARIOS,
	formatCurrencyFull,
	formatMultiplier,
	formatNumber,
	formatPercent,
} from "./calculator-engine";
import type { Scenario } from "./calculator-engine";

export function ScenariosSection() {
	return (
		<section className="mx-auto w-full max-w-5xl">
			<div className="mb-8 text-center">
				<p className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-widest">
					Pre-built Scenarios
				</p>
				<h2 className="mb-3 font-bold text-2xl tracking-tight sm:text-3xl">
					The numbers across 5 real-world profiles
				</h2>
				<p className="mx-auto max-w-2xl text-balance text-muted-foreground text-sm">
					From a small blog to a high-traffic platform. These are the
					revenue numbers your cookie banner is quietly eating.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{SCENARIOS.map((scenario, i) => (
					<ScenarioCard
						featured={i === 2}
						key={scenario.name}
						scenario={scenario}
					/>
				))}

				<SciFiCard>
					<div className="flex h-full flex-col items-center justify-center rounded border border-dashed border-border bg-card/40 p-5 text-center backdrop-blur-sm">
						<p className="mb-2 font-semibold text-sm">
							Your site?
						</p>
						<p className="mb-4 text-muted-foreground text-xs">
							Plug in your own numbers above
						</p>
						<a
							className="font-mono text-xs underline underline-offset-2 hover:text-foreground"
							href="#calculator"
						>
							Go to calculator
						</a>
					</div>
				</SciFiCard>
			</div>
		</section>
	);
}

function ScenarioCard({
	scenario,
	featured = false,
}: {
	scenario: Scenario;
	featured?: boolean;
}) {
	return (
		<SciFiCard>
			<div
				className={cn(
					"flex h-full flex-col rounded border border-border bg-card/70 p-5 backdrop-blur-sm",
					featured && "border-destructive/30"
				)}
			>
				<div className="mb-4">
					<div className="flex items-center justify-between">
						<h3 className="font-semibold text-sm">
							{scenario.name}
						</h3>
						{featured && (
							<span className="rounded border border-destructive/30 bg-destructive/10 px-2 py-0.5 font-mono text-destructive text-xs">
								screenshot this
							</span>
						)}
					</div>
					<p className="mt-0.5 text-muted-foreground text-xs">
						{scenario.description}
					</p>
				</div>

				<div className="mb-4 space-y-2 text-xs">
					<div className="flex justify-between">
						<span className="text-muted-foreground">Visitors</span>
						<span className="font-mono tabular-nums">
							{formatNumber(scenario.inputs.monthlyVisitors)}/mo
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">
							Banner bounce
						</span>
						<span className="font-mono tabular-nums">
							{formatPercent(scenario.inputs.bannerBounceRate)}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">
							Conversion rate
						</span>
						<span className="font-mono tabular-nums">
							{formatPercent(scenario.inputs.conversionRate)}
						</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">
							Rev / conversion
						</span>
						<span className="font-mono tabular-nums">
							${scenario.inputs.revenuePerConversion}
						</span>
					</div>
				</div>

				<div className="mt-auto space-y-3 border-border border-t pt-3">
					<div className="flex items-baseline justify-between">
						<span className="text-muted-foreground text-xs">
							Lost / year
						</span>
						<span className="font-bold text-destructive text-lg tabular-nums">
							{formatCurrencyFull(scenario.outputs.lostRevenueYearly)}
						</span>
					</div>
					<div className="flex items-center justify-between">
						<span className="text-muted-foreground text-xs">
							ROI vs Databuddy
						</span>
						<span className="font-mono text-sm tabular-nums">
							{formatMultiplier(scenario.outputs.roiMultiplier)}x
						</span>
					</div>
				</div>
			</div>
		</SciFiCard>
	);
}
