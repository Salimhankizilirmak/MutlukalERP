import { createClient } from "@libsql/client";
import { drizzle, LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";

let db: LibSQLDatabase<typeof schema>;

if (process.env.VERCEL) {
  db = new Proxy({}, {
    get(target, prop) {
      return () => {
        throw new Error("Vercel üzerinde doğrudan veritabanı erişimi desteklenmiyor.");
      };
    }
  }) as any;
} else {
  const dbPath = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "mutlukal.db")}`;
  const client = createClient({ url: dbPath });
  db = drizzle(client, { schema });
}

export { db };
