import { ImageResponse } from "next/og";

export const runtime = "edge";

export function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const revenue = searchParams.get("revenue") || "0";
	const visitors = searchParams.get("visitors") || "0";
	const roi = searchParams.get("roi") || "0";

	const revenueNum = Number.parseInt(revenue, 10);
	const visitorsNum = Number.parseInt(visitors, 10);
	const roiNum = Number.parseInt(roi, 10);

	const formattedRevenue = `$${revenueNum.toLocaleString("en-US")}`;
	const formattedVisitors = visitorsNum.toLocaleString("en-US");
	const formattedRoi = `${roiNum}x`;

	return new ImageResponse(
		<div
			style={{
				height: "100%",
				width: "100%",
				display: "flex",
				flexDirection: "column",
				backgroundColor: "#0a0a0a",
				position: "relative",
				overflow: "hidden",
			}}
		>
			{/* Grid background */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					backgroundImage:
						"linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
					backgroundSize: "48px 48px",
				}}
			/>

			{/* Accent glow */}
			<div
				style={{
					position: "absolute",
					top: "-20%",
					right: "-10%",
					width: "600px",
					height: "500px",
					background:
						"radial-gradient(ellipse at center, rgba(239, 68, 68, 0.08), transparent 70%)",
				}}
			/>

			{/* Top bar */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "40px 60px 0",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "14px",
					}}
				>
					<svg
						height="36"
						style={{ borderRadius: "4px" }}
						viewBox="0 0 8 8"
						width="36"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>Databuddy</title>
						<path d="M0 0h8v8H0z" fill="#000" />
						<path
							d="M1 1h1v6H1zm1 0h4v1H2zm4 1h1v1H6zm0 1h1v1H6zm0 1h1v1H6zm0 1h1v1H6zM2 6h4v1H2zm1-3h1v1H3zm1 1h1v1H4z"
							fill="#fff"
						/>
					</svg>
					<span
						style={{
							color: "#ffffff",
							fontSize: "18px",
							fontWeight: 600,
							fontFamily: "monospace",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
						}}
					>
						Databuddy
					</span>
				</div>
				<span
					style={{
						color: "#525252",
						fontSize: "14px",
						fontFamily: "monospace",
						letterSpacing: "0.05em",
					}}
				>
					Cookie Banner Cost Calculator
				</span>
			</div>

			{/* Main content */}
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					flex: 1,
					padding: "0 60px",
					gap: "32px",
				}}
			>
				{/* Big number */}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						gap: "8px",
					}}
				>
					<span
						style={{
							color: "#737373",
							fontSize: "16px",
							textTransform: "uppercase",
							letterSpacing: "0.15em",
							fontFamily: "monospace",
						}}
					>
						Lost Revenue Per Year
					</span>
					<span
						style={{
							color: "#ef4444",
							fontSize: "96px",
							fontWeight: 800,
							letterSpacing: "-0.04em",
							lineHeight: 1,
						}}
					>
						{formattedRevenue}
					</span>
				</div>

				{/* Stats row */}
				<div
					style={{
						display: "flex",
						gap: "48px",
						alignItems: "center",
					}}
				>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "4px",
						}}
					>
						<span
							style={{
								color: "#525252",
								fontSize: "12px",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
								fontFamily: "monospace",
							}}
						>
							Monthly Visitors
						</span>
						<span
							style={{
								color: "#ffffff",
								fontSize: "28px",
								fontWeight: 700,
							}}
						>
							{formattedVisitors}
						</span>
					</div>
					<div
						style={{
							width: "1px",
							height: "40px",
							backgroundColor: "rgba(255,255,255,0.1)",
						}}
					/>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "4px",
						}}
					>
						<span
							style={{
								color: "#525252",
								fontSize: "12px",
								textTransform: "uppercase",
								letterSpacing: "0.1em",
								fontFamily: "monospace",
							}}
						>
							ROI vs Databuddy
						</span>
						<span
							style={{
								color: "#ffffff",
								fontSize: "28px",
								fontWeight: 700,
							}}
						>
							{formattedRoi}
						</span>
					</div>
				</div>
			</div>

			{/* Bottom CTA */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: "0 60px 40px",
				}}
			>
				<span
					style={{
						color: "#525252",
						fontSize: "18px",
						fontFamily: "monospace",
					}}
				>
					Calculate yours at databuddy.cc/calculator
				</span>
			</div>
		</div>,
		{
			width: 1200,
			height: 630,
		}
	);
}
