import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Initializes the serverless connection over HTTP
const sql = neon(process.env.DATABASE_URL!);

// Exports the 'db' object so we can use it in our Server Actions
export const db = drizzle(sql, { schema });