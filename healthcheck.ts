const port = process.env.HEALTHCHECK_PORT ?? process.env.PORT ?? "3000";
const r = await fetch(`http://localhost:${port}/health`);
process.exit(r.ok ? 0 : 1);
