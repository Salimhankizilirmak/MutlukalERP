import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";

const dbPath = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "mutlukal.db")}`;

const client = createClient({ url: dbPath });

export const db = drizzle(client, { schema });
