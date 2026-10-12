import "server-only";

import { MongoClient, type Db } from "mongodb";

import { getEnv } from "@/server/env";

/**
 * Shared MongoDB client. On Vercel (serverless) the client is cached on
 * globalThis so warm invocations and dev hot reloads reuse one connection pool.
 */
const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(getEnv().MONGODB_URI);
}

function getClient(): Promise<MongoClient> {
  const { MONGODB_URI } = getEnv();
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, {
      appName: "rozvojklubu",
      maxPoolSize: 10,
    });
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(getEnv().MONGODB_DB);
}
