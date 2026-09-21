import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL ?? "postgresql://cfranked:cfranked@localhost:5433/cfranked";

// Reuse the client across HMR reloads in dev so we don't leak connections.
const globalForDb = globalThis as unknown as { __cfPg?: ReturnType<typeof postgres> };

const client = globalForDb.__cfPg ?? postgres(connectionString, { max: 5 });
if (process.env.NODE_ENV !== "production") globalForDb.__cfPg = client;

export const db = drizzle(client, { schema });
export { schema };
