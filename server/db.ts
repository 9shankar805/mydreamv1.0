import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

// This will be loaded from .env file via dotenv
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set in .env file. Please check your configuration",
  );
}

// Create a connection pool with proper timeout and SSL configuration
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { 
    rejectUnauthorized: false 
  } : false,
  connectionTimeoutMillis: 10000, // 10 seconds
  idleTimeoutMillis: 30000, // 30 seconds
  max: 20, // Maximum number of clients in the pool
});

// Log database connection status
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Database connection error:', err.message);
  // Don't exit the process, let the connection pool handle reconnection
});

// Add connection retry logic
let retryCount = 0;
const MAX_RETRIES = 5;

async function testConnection() {
  const client = await pool.connect().catch(err => {
    console.error('Failed to connect to database:', err.message);
    return null;
  });
  
  if (client) {
    try {
      await client.query('SELECT 1');
      console.log('Database connection test successful');
      retryCount = 0;
      return true;
    } catch (err) {
      console.error('Database connection test failed:', err.message);
      return false;
    } finally {
      client.release();
    }
  }
  return false;
}

// Test connection on startup
testConnection().then(success => {
  if (!success && retryCount < MAX_RETRIES) {
    retryCount++;
    console.log(`Retrying database connection (${retryCount}/${MAX_RETRIES})...`);
    setTimeout(testConnection, 5000);
  }
});

export { pool };
export const db = drizzle(pool, { schema });