'server-only'

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

const tursoDbUrl = process.env.TURSO_DATABASE_URL;
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoDbUrl) {
    throw new Error('TURSO_DATABASE_URL is not set in the environment variables');
}

const client = createClient({
  url: tursoDbUrl,
  authToken: tursoAuthToken,
});

export const db = drizzle(client, { schema });
