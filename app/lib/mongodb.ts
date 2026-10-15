import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // Read lazily, not at module scope: on Cloudflare Workers (via OpenNext) process.env isn't
  // populated until request-scoped context runs, so a module-scope read can capture undefined
  // before Cloudflare ever injects the real value — and it would stay cached that way forever
  // since this used to be a top-level const. Same failure mode fixed for Stripe's client init.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable in .env');
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('quickbooks_enterprises');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
