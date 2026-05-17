import { MongoClient, ServerApiVersion } from "mongodb";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;

loadEnvFile(".env.local");
loadEnvFile(".env");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "la_esquinita";
const email = process.env.AUTH_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const password = process.env.AUTH_BOOTSTRAP_PASSWORD;
const name = process.env.AUTH_BOOTSTRAP_NAME?.trim() || "La Esquinita";

if (!uri) {
  fail("Missing MONGODB_URI.");
}

if (!email || !password) {
  fail("Missing AUTH_BOOTSTRAP_EMAIL or AUTH_BOOTSTRAP_PASSWORD.");
}

if (password.length < 12) {
  fail("AUTH_BOOTSTRAP_PASSWORD must be at least 12 characters.");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true
  }
});

try {
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection("users");
  await users.createIndex({ email: 1 }, { unique: true, name: "user_email_unique" });

  const existingUser = await users.findOne({});
  if (existingUser) {
    fail("A user already exists. Bootstrap is intentionally one-time only.");
  }

  const now = new Date();
  await users.insertOne({
    email,
    name,
    passwordHash: await hashPassword(password),
    role: "owner",
    active: true,
    createdAt: now,
    updatedAt: now
  });

  console.log(`Created owner user: ${email}`);
} finally {
  await client.close();
}

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return;
  }

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();

    if (!process.env[key]) {
      process.env[key] = value.replace(/^["']|["']$/g, "");
    }
  }
}

async function hashPassword(rawPassword) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = await scrypt(rawPassword, salt, PASSWORD_KEY_LENGTH);
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
