import { MongoClient, Db } from 'mongodb';

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // Read lazily, not at module scope: on Cloudflare Workers (via OpenNext) process.env isn't
  // populated until request-scoped context runs, so a module-scope read can capture undefined
  // before Cloudflare ever injects the real value. Same failure mode fixed for Stripe's client
  // init.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('Please define the MONGODB_URI environment variable in .env');
  }

  // Deliberately NOT caching the client/connection across invocations (the previous version
  // did, via module-level cachedClient/cachedDb). On Cloudflare Workers, I/O objects — sockets
  // included — are torn down once the request that created them finishes; a later invocation
  // reusing a cached MongoClient is reusing a socket the platform already closed out from
  // under it. That failure is silent (the underlying exception gets swallowed rather than
  // rejecting the promise), which is what was surfacing as Cloudflare's own 1101 "Worker threw
  // exception" page on an unpredictable subset of requests — reusing the Worker's warm isolate
  // but not the dead connection. Connecting fresh every call costs a connection setup per
  // request but is the behavior this platform actually supports.
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('quickbooks_enterprises');

  return { client, db };
}
