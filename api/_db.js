import { neon } from "@neondatabase/serverless";

let client;

export function database() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    const error = new Error("Database is not configured");
    error.code = "database_not_configured";
    throw error;
  }
  if (!client) client = neon(connectionString);
  return client;
}
