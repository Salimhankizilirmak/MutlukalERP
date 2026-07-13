import { defineConfig } from "drizzle-kit";
import path from "path";

const dbPath = process.env.DATABASE_URL ?? `file:${path.join(process.cwd(), "mutlukal.db")}`;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: dbPath,
  },
});
