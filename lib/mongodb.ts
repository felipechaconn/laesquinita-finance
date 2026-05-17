import { MongoClient, ServerApiVersion, type Db } from "mongodb";

const dbName = process.env.MONGODB_DB ?? "la_esquinita";

type CachedClient = {
  client: MongoClient | null;
  promise: Promise<MongoClient> | null;
};

const globalForMongo = globalThis as typeof globalThis & {
  _laEsquinitaMongo?: CachedClient;
};

const cached = globalForMongo._laEsquinitaMongo ?? { client: null, promise: null };

if (!globalForMongo._laEsquinitaMongo) {
  globalForMongo._laEsquinitaMongo = cached;
}

export async function getMongoClient() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI. Add it to .env.local before using the database.");
  }

  if (cached.client) {
    return cached.client;
  }

  if (!cached.promise) {
    const client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: false,
        deprecationErrors: true
      },
      maxPoolSize: 10
    });

    cached.promise = client.connect();
  }

  cached.client = await cached.promise;
  return cached.client;
}

export async function getDb(): Promise<Db> {
  const client = await getMongoClient();
  return client.db(dbName);
}
