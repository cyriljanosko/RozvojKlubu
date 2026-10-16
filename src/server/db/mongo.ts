import "server-only";

import { MongoClient, type Db } from "mongodb";

import { getEnv } from "@/server/env";

/**
 * Shared MongoDB client. On Vercel (serverless) the client is cached on
 * globalThis so warm invocations and dev hot reloads reuse one connection pool.
 * The driver connects lazily on the first operation and reconnects on its own,
 * so a failed first attempt does not poison the cached client.
 */
const globalForMongo = globalThis as unknown as {
  _mongoClient?: MongoClient;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(getEnv().MONGODB_URI);
}

export function getMongoClient(): MongoClient {
  const { MONGODB_URI } = getEnv();
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }
  globalForMongo._mongoClient ??= new MongoClient(MONGODB_URI, {
    appName: "rozvojklubu",
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 8000,
  });
  return globalForMongo._mongoClient;
}

/** Synchronous handle to the app database (connection is opened lazily). */
export function getDbSync(): Db {
  return getMongoClient().db(getEnv().MONGODB_DB);
}

export async function getDb(): Promise<Db> {
  return getDbSync();
}
