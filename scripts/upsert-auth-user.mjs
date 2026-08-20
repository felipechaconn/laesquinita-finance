import { MongoClient, ServerApiVersion } from "mongodb";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_KEY_LENGTH = 64;
const ROLES = new Set(["owner", "staff", "contractor"]);

loadEnvFile(".env.local");
loadEnvFile(".env");

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "la_esquinita";
const email = process.env.AUTH_USER_EMAIL?.trim().toLowerCase();
const password = process.env.AUTH_USER_PASSWORD;
const name = process.env.AUTH_USER_NAME?.trim();
const role = process.env.AUTH_USER_ROLE?.trim().toLowerCase() || "contractor";

if (!uri) {
  fail("Missing MONGODB_URI.");
}

if (!email) {
  fail("Missing AUTH_USER_EMAIL.");
}

if (!ROLES.has(role)) {
  fail("AUTH_USER_ROLE must be owner, staff, or contractor.");
}

if (password && password.length < 12) {
  fail("AUTH_USER_PASSWORD must be at least 12 characters.");
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

  const existingUser = await users.findOne({ email });
  const now = new Date();
  const update = {
    $set: {
      email,
      name: name || existingUser?.name || email,
      role,
      active: true,
      updatedAt: now,
      ...(password ? { passwordHash: await hashPassword(password) } : {})
    },
    $setOnInsert: {
      createdAt: now
    }
  };

  if (!existingUser && !password) {
    fail("AUTH_USER_PASSWORD is required when creating a new user.");
  }

  await users.updateOne({ email }, update, { upsert: true });
  console.log(`${existingUser ? "Updated" : "Created"} ${role} user: ${email}`);
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
