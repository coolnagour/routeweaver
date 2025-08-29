// simple-test.ts
import { createClient } from '@libsql/client';
import 'dotenv/config';

const client = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function simpleTest() {
  try {
    // Just test basic query, no migrations
    const result = await client.execute('SELECT sqlite_version() as version');
    console.log('✅ Basic connection works!');
    console.log('SQLite version:', result.rows[0]);
  } catch (error) {
    console.error('❌ Basic connection failed:', error);
  }
}

simpleTest();