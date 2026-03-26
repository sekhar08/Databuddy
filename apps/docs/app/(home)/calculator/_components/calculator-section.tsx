"use client";

import { useState } from "react";
import { SciFiCard } from "@/components/scifi-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
	calculateCookieBannerCost,
	formatCurrencyFull,
	formatMultiplier,
	formatNumber,
	formatPercent,
} from "./calculator-engine";
import { ShareButtons } from "./share-buttons";

const DEFAULT_VISITORS = 50_000;
const DEFAULT_BOUNCE_RATE = 0.09;
const DEFAULT_CONVERSION_RATE = 0.03;
const DEFAULT_REVENUE_PER_CONVERSION = 85;

function percentToSlider(value: number): number {
	return Math.round(value * 1000);
}

function sliderToPercent(value: number): number {
	return value / 1000;
}

export function CalculatorSection() {
	const [monthlyVisitors, setMonthlyVisitors] = useState(DEFAULT_VISITORS);
	const [bannerBounceRate, setBannerBounceRate] = useState(DEFAULT_BOUNCE_RATE);
	const [conversionRate, setConversionRate] = useState(
		DEFAULT_CONVERSION_RATE
	);
	const [revenuePerConversion, setRevenuePerConversion] = useState(
		DEFAULT_REVENUE_PER_CONVERSION
	);

	const results = calculateCookieBannerCost({
		monthlyVisitors,
		bannerBounceRate,
		conversionRate,
		revenuePerConversion,
	});

	return (
		<section className="mx-auto w-full max-w-5xl" id="calculator">
			<div className="mb-8 text-center">
				<p className="mb-2 font-mono text-muted-foreground text-xs uppercase tracking-widest">
					Cookie Banner Cost Calculator
				</p>
				<h2 className="mb-3 font-bold text-2xl tracking-tight sm:text-3xl">
					How much is your cookie banner costing you?
				</h2>
				<p className="mx-auto max-w-2xl text-balance text-muted-foreground text-sm">
					Adjust the inputs below. Every output updates in real time.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
				<div className="lg:col-span-3">
					<SciFiCard>
						<div className="rounded border border-border bg-card/70 p-5 backdrop-blur-sm sm:p-6">
							<h3 className="mb-5 font-semibold text-sm uppercase tracking-wider">
								Your Numbers
							</h3>

							<div className="space-y-6">
								<InputField
									hint="Total unique visitors per month"
									id="visitors"
									label="Monthly Visitors"
									max={2_000_000}
									min={0}
									sliderMax={100}
									sliderStep={1}
									sliderToValue={(v) =>
										Math.round(
											(v / 100) ** 2.5 * 2_000_000
										)
									}
									step={1000}
									suffix="/mo"
									value={monthlyVisitors}
									valueToSlider={(v) =>
										Math.round(
											(v / 2_000_000) ** (1 / 2.5) * 100
										)
									}
									onChangeAction={setMonthlyVisitors}
								/>

								<InputField
									displayPercent
									hint="% of visitors who leave because of your cookie banner"
									id="bounce"
									label="Banner Bounce Rate"
									max={0.3}
									min={0}
									sliderMax={300}
									sliderStep={1}
									sliderToValue={sliderToPercent}
									step={0.01}
									value={bannerBounceRate}
									valueToSlider={percentToSlider}
									onChangeAction={setBannerBounceRate}
								/>

								<InputField
									displayPercent
									hint="% of visitors who convert (buy, sign up, etc.)"
									id="conversion"
									label="Conversion Rate"
									max={0.2}
									min={0}
									sliderMax={200}
									sliderStep={1}
									sliderToValue={sliderToPercent}
									step={0.005}
									value={conversionRate}
									valueToSlider={percentToSlider}
									onChangeAction={setConversionRate}
								/>

								<InputField
									hint="Average revenue per conversion"
									id="revenue"
									label="Revenue per Conversion"
									max={1000}
									min={0}
									prefix="$"
									sliderMax={1000}
									sliderStep={5}
									sliderToValue={(v) => v}
									step={5}
									value={revenuePerConversion}
									valueToSlider={(v) => v}
									onChangeAction={setRevenuePerConversion}
								/>
							</div>
						</div>
					</SciFiCard>
				</div>

				<div className="lg:col-span-2">
					<SciFiCard>
						<div className="flex h-full flex-col rounded border border-border bg-card/70 p-5 backdrop-blur-sm sm:p-6">
							<h3 className="mb-5 font-semibold text-sm uppercase tracking-wider">
								What You're Losing
							</h3>

							<div className="flex flex-1 flex-col justify-between gap-4">
								<ResultRow
									label="Lost Visitors / mo"
									value={formatNumber(results.lostVisitors)}
								/>
								<ResultRow
									label="Lost Conversions / mo"
									value={formatNumber(results.lostConversions)}
								/>
								<ResultRow
									highlight
									label="Lost Revenue / mo"
									value={formatCurrencyFull(
										results.lostRevenueMonthly
									)}
								/>

								<Separator />

								<div className="rounded border border-destructive/20 bg-destructive/5 p-4">
									<p className="mb-1 text-muted-foreground text-xs uppercase tracking-wider">
										Lost Revenue / Year
									</p>
									<p className="font-bold text-2xl tabular-nums tracking-tight text-destructive sm:text-3xl">
										{formatCurrencyFull(
											results.lostRevenueYearly
										)}
									</p>
								</div>

								<div className="flex items-center justify-between rounded border border-border bg-card/40 p-3">
									<div>
										<p className="text-muted-foreground text-xs">
											ROI vs Databuddy{" "}
											{results.databuddyPlanName} (
											{formatCurrencyFull(
												results.databuddyMonthlyCost
											)}
											/mo)
										</p>
										<p className="font-semibold text-lg tabular-nums">
											{formatMultiplier(
												results.roiMultiplier
											)}
											x return
										</p>
									</div>
								</div>
							</div>

							<Separator className="my-4" />

							<ShareButtons
								lostRevenueYearly={results.lostRevenueYearly}
								monthlyVisitors={monthlyVisitors}
								roiMultiplier={results.roiMultiplier}
							/>
						</div>
					</SciFiCard>
				</div>
			</div>

			<div className="mt-4 text-center">
				<p className="text-muted-foreground text-xs">
					Based on{" "}
					<a
						className="underline underline-offset-2 hover:text-foreground"
						href="https://www.cookiebot.com/en/cookie-banner-statistics/"
						rel="noopener noreferrer"
						target="_blank"
					>
						industry research
					</a>{" "}
					showing 9-12% bounce rates from cookie consent banners.
					Databuddy uses no cookies, so no banner is needed.
				</p>
			</div>
		</section>
	);
}

interface InputFieldProps {
	id: string;
	label: string;
	hint: string;
	value: number;
	onChangeAction: (value: number) => void;
	min: number;
	max: number;
	step: number;
	sliderMin?: number;
	sliderMax: number;
	sliderStep: number;
	valueToSlider: (value: number) => number;
	sliderToValue: (slider: number) => number;
	prefix?: string;
	suffix?: string;
	displayPercent?: boolean;
}

function InputField({
	id,
	label,
	hint,
	value,
	onChangeAction,
	min,
	max,
	step,
	sliderMin = 0,
	sliderMax,
	sliderStep,
	valueToSlider,
	sliderToValue,
	prefix,
	suffix,
	displayPercent,
}: InputFieldProps) {
	const displayValue = displayPercent
		? formatPercent(value)
		: `${prefix ?? ""}${formatNumber(value)}${suffix ?? ""}`;

	return (
		<div>
			<div className="mb-2 flex items-baseline justify-between">
				<Label className="text-sm" htmlFor={id}>
					{label}
				</Label>
				<span className="font-mono font-semibold text-base tabular-nums">
					{displayValue}
				</span>
			</div>
			<Slider
				aria-label={label}
				max={sliderMax}
				min={sliderMin}
				step={sliderStep}
				value={[valueToSlider(value)]}
				onValueChange={(v) => {
					const raw = sliderToValue(Number(v.at(0) ?? 0));
					onChangeAction(
						Math.min(max, Math.max(min, raw))
					);
				}}
			/>
			<p className="mt-1.5 text-muted-foreground text-xs">{hint}</p>
		</div>
	);
}

function ResultRow({
	label,
	value,
	highlight = false,
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<div className="flex items-center justify-between">
			<span className="text-muted-foreground text-sm">{label}</span>
			<span
				className={cn(
					"font-semibold tabular-nums",
					highlight ? "text-base" : "text-sm"
				)}
			>
				{value}
			</span>
		</div>
	);
}
