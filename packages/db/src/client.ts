/** biome-ignore-all lint/performance/noNamespaceImport: "Required" */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as relations from "./drizzle/relations";
import * as schema from "./drizzle/schema";

const fullSchema = { ...schema, ...relations };

const databaseUrl = process.env.DATABASE_URL as string;

if (!databaseUrl) {
	throw new Error("DATABASE_URL is not set");
}

/**
 * libpq accepts `sslrootcert=system` (use OS trust store). node-postgres treats
 * `sslrootcert` as a file path and tries to open `system`, causing ENOENT.
 */
function connectionStringForNodePg(connectionString: string): string {
	try {
		const parsed = new URL(connectionString);
		if (parsed.searchParams.get("sslrootcert") === "system") {
			parsed.searchParams.delete("sslrootcert");
		}
		return parsed.toString();
	} catch {
		return connectionString;
	}
}

const pool = new Pool({
	connectionString: connectionStringForNodePg(databaseUrl),
	max: Number.parseInt(process.env.DB_POOL_MAX ?? "20", 10) || 20,
	idleTimeoutMillis: 30_000,
	connectionTimeoutMillis: 5000,
});

export const db = drizzle(pool, {
	schema: fullSchema,
});
