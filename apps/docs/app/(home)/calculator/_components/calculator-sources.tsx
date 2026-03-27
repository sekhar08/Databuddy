export function CalculatorSources() {
	return (
		<div className="mx-auto w-full max-w-3xl rounded border border-border bg-card/40 px-4 py-5 text-center sm:px-6">
			<p className="text-pretty text-muted-foreground text-xs leading-relaxed sm:text-sm">
				<span className="text-foreground/80">Sources: </span>
				<a
					className="underline underline-offset-2 hover:text-foreground"
					href="https://www.advance-metrics.com/en/blog/cookie-behaviour-study/"
					rel="noopener noreferrer"
					target="_blank"
				>
					Analysis of 1.2M+ banner interactions (Advance Metrics)
				</a>
				<span aria-hidden="true">, </span>
				<a
					className="underline underline-offset-2 hover:text-foreground"
					href="https://www.modernisation.gouv.fr/publications/la-ditp-mesure-limpact-du-design-des-bannieres-cookies-sur-les-internautes"
					rel="noopener noreferrer"
					target="_blank"
				>
					CNIL/DITP banner design study (2023)
				</a>
				<span aria-hidden="true">, </span>
				<a
					className="underline underline-offset-2 hover:text-foreground"
					href="https://www.dlapiper.com/en-gb/insights/publications/2026/01/dla-piper-gdpr-fines-and-data-breach-survey-january-2026"
					rel="noopener noreferrer"
					target="_blank"
				>
					DLA Piper GDPR Survey 2026
				</a>
				.
			</p>
		</div>
	);
}
