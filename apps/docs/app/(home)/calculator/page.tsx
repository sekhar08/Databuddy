import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { SITE_URL } from "@/app/util/constants";
import { CalculatorSection } from "./_components/calculator-section";
import { CtaSection } from "./_components/cta-section";
import { ScenariosSection } from "./_components/scenarios-section";

const TITLE = "Cookie Banner Cost Calculator";
const DESCRIPTION =
	"Cookie consent banners bounce 9–12% of visitors before they see your site. Plug in your numbers and see how much revenue you're losing every month.";

const DEFAULT_OG_PARAMS = "revenue=78000&visitors=25000&roi=722";

interface PageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({
	searchParams,
}: PageProps): Promise<Metadata> {
	const params = await searchParams;
	const revenue = typeof params.revenue === "string" ? params.revenue : null;
	const visitors =
		typeof params.visitors === "string" ? params.visitors : null;
	const roi = typeof params.roi === "string" ? params.roi : null;

	const hasPersonalizedParams = revenue && visitors && roi;

	const ogParams = hasPersonalizedParams
		? `revenue=${revenue}&visitors=${visitors}&roi=${roi}`
		: DEFAULT_OG_PARAMS;

	const ogImageUrl = `${SITE_URL}/calculator/og?${ogParams}`;

	const personalizedDescription = hasPersonalizedParams
		? `This cookie banner is costing $${Number(revenue).toLocaleString()}/year in lost revenue. Calculate yours.`
		: DESCRIPTION;

	return {
		title: TITLE,
		description: personalizedDescription,
		openGraph: {
			title: TITLE,
			description: personalizedDescription,
			url: `${SITE_URL}/calculator`,
			images: [
				{
					url: ogImageUrl,
					width: 1200,
					height: 630,
					alt: "Cookie Banner Cost Calculator results",
				},
			],
		},
		twitter: {
			card: "summary_large_image",
			title: TITLE,
			description: personalizedDescription,
			images: [ogImageUrl],
		},
	};
}

export default function CalculatorPage() {
	return (
		<div className="px-4 pt-10 sm:px-6 lg:px-8">
			<div className="mx-auto w-full max-w-7xl">
				<header className="mb-12 text-center sm:mb-16">
					<p className="mb-3 font-mono text-muted-foreground text-xs uppercase tracking-widest">
						Free Tool
					</p>
					<h1 className="mb-3 font-bold text-3xl tracking-tight sm:text-4xl lg:text-5xl">
						Cookie Banner Cost Calculator
					</h1>
					<p className="mx-auto max-w-2xl text-balance text-muted-foreground text-sm sm:text-base">
						Cookie consent banners bounce 9–12% of visitors before
						they even see your site. Plug in your numbers and see
						exactly how much revenue you're losing every month.
					</p>
				</header>

				<div className="space-y-16 sm:space-y-24">
					<CalculatorSection />
					<ScenariosSection />
					<CtaSection />
				</div>

				<Footer />
			</div>
		</div>
	);
}
