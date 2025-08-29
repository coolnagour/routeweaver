import { defineConfig } from "drizzle-kit";
import * as dotenv from 'dotenv';

dotenv.config();

const tursoDbUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoDbUrl) {
    throw new Error('TURSO_DATABASE_URL is not set in the environment variables');
}
if (!tursoAuthToken) {
    throw new Error('TURSO_AUTH_TOKEN is not set in the environment variables');
}

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/drizzle/schema.ts",
  out: "./drizzle",
  driver: "turso",
  dbCredentials: {
    url: tursoDbUrl,
    authToken: tursoAuthToken,
  },
  verbose: true,
  strict: true,
});
