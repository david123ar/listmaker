import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = "mydatabase";

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in .env");
}

let cached = global._mongo;

if (!cached) {
  cached = global._mongo = {
    client: null,
    promise: null,
  };
}

export async function connectDB() {
  if (cached.client) {
    return cached.client.db(MONGODB_DB);
  }

  if (!cached.promise) {
    const client = new MongoClient(MONGODB_URI);
    cached.promise = client.connect();
  }

  cached.client = await cached.promise;
  return cached.client.db(MONGODB_DB);
}