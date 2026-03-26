"use client";

import { FaRedditAlien, FaXTwitter } from "react-icons/fa6";
import { SciFiButton } from "@/components/landing/scifi-btn";
import { formatCurrencyFull } from "./calculator-engine";

const CALCULATOR_BASE = "https://www.databuddy.cc/calculator";

function buildShareUrl(
	lostRevenueYearly: number,
	monthlyVisitors: number,
	roiMultiplier: number
): string {
	const params = new URLSearchParams({
		revenue: String(Math.round(lostRevenueYearly)),
		visitors: String(Math.round(monthlyVisitors)),
		roi: String(Math.round(roiMultiplier)),
	});
	return `${CALCULATOR_BASE}?${params.toString()}`;
}

function buildTwitterShareUrl(
	lostRevenueYearly: number,
	monthlyVisitors: number,
	roiMultiplier: number
): string {
	const shareUrl = buildShareUrl(
		lostRevenueYearly,
		monthlyVisitors,
		roiMultiplier
	);
	const text = `🍪 My cookie banner is costing me ${formatCurrencyFull(lostRevenueYearly)}/year in lost revenue. Calculate yours →`;
	const params = new URLSearchParams({ text, url: shareUrl });
	return `https://x.com/intent/tweet?${params.toString()}`;
}

function buildRedditShareUrl(
	lostRevenueYearly: number,
	monthlyVisitors: number,
	roiMultiplier: number
): string {
	const shareUrl = buildShareUrl(
		lostRevenueYearly,
		monthlyVisitors,
		roiMultiplier
	);
	const title = `My cookie banner is costing me ${formatCurrencyFull(lostRevenueYearly)}/year — here's the math`;
	const params = new URLSearchParams({ url: shareUrl, title });
	return `https://www.reddit.com/submit?${params.toString()}`;
}

interface ShareButtonsProps {
	lostRevenueYearly: number;
	monthlyVisitors: number;
	roiMultiplier: number;
}

export function ShareButtons({
	lostRevenueYearly,
	monthlyVisitors,
	roiMultiplier,
}: ShareButtonsProps) {
	const twitterUrl = buildTwitterShareUrl(
		lostRevenueYearly,
		monthlyVisitors,
		roiMultiplier
	);
	const redditUrl = buildRedditShareUrl(
		lostRevenueYearly,
		monthlyVisitors,
		roiMultiplier
	);

	return (
		<div className="space-y-3">
			<p className="text-muted-foreground text-xs">
				Share your results (with your numbers baked into the preview)
			</p>
			<div className="flex flex-wrap gap-2">
				<SciFiButton asChild>
					<a
						href={twitterUrl}
						rel="noopener noreferrer"
						target="_blank"
					>
						<FaXTwitter className="size-3.5" />
						<span>Share on X</span>
					</a>
				</SciFiButton>
				<SciFiButton asChild>
					<a
						href={redditUrl}
						rel="noopener noreferrer"
						target="_blank"
					>
						<FaRedditAlien className="size-3.5" />
						<span>Share on Reddit</span>
					</a>
				</SciFiButton>
			</div>
		</div>
	);
}
