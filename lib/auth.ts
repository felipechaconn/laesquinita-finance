import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";

import { SESSION_COOKIE } from "@/lib/auth-constants";
import { getCollections } from "@/lib/collections";
import type { AuthUser } from "@/lib/auth-types";

const scrypt = promisify(scryptCallback);

const PASSWORD_KEY_LENGTH = 64;
const SESSION_DAYS = 14;

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: AuthUser["role"];
};

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, PASSWORD_KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, key] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }

  const storedKey = Buffer.from(key, "hex");
  const derivedKey = (await scrypt(password, salt, storedKey.length)) as Buffer;

  return storedKey.length === derivedKey.length && timingSafeEqual(storedKey, derivedKey);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(user: AuthUser) {
  if (!user._id) {
    throw new Error("User must have an id before creating a session.");
  }

  const { sessions } = await getCollections();
  const token = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  await sessions.insertOne({
    userId: typeof user._id === "string" ? new ObjectId(user._id) : user._id,
    tokenHash: hashSessionToken(token),
    expiresAt,
    createdAt: now,
    lastSeenAt: now
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const { sessions } = await getCollections();
    await sessions.deleteOne({ tokenHash: hashSessionToken(token) });
  }

  cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const { users, sessions } = await getCollections();
  const now = new Date();
  const session = await sessions.findOne({
    tokenHash: hashSessionToken(token),
    expiresAt: { $gt: now }
  });

  if (!session) {
    return null;
  }

  const userId = typeof session.userId === "string" ? new ObjectId(session.userId) : session.userId;
  const user = await users.findOne({ _id: userId, active: true });

  if (!user) {
    return null;
  }

  await sessions.updateOne({ _id: session._id }, { $set: { lastSeenAt: now } });

  return {
    id: user._id?.toString() ?? "",
    email: user.email,
    name: user.name,
    role: user.role
  };
}

export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    throw new AuthRequiredError();
  }

  return user;
}

export class AuthRequiredError extends Error {
  constructor() {
    super("Authentication required.");
    this.name = "AuthRequiredError";
  }
}

export function publicUser(user: AuthUser): PublicUser {
  return {
    id: user._id?.toString() ?? "",
    email: user.email,
    name: user.name,
    role: user.role
  };
}
