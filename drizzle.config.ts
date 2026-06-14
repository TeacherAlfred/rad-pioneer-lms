import * as dotenv from 'dotenv';
import type { Config } from 'drizzle-kit';

// Read from your local environment file
dotenv.config({ path: '.env.local' });

const config: Config = {
  schema: './src/db/schema/*',
  out: './drizzle',
  dialect: 'postgresql', // Explicitly stated as a literal type
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
};

export default config;