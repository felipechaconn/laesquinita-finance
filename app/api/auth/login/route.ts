import { NextResponse } from "next/server";
import { z } from "zod";
import type { UpdateFilter } from "mongodb";

import { createSession, publicUser, verifyPassword } from "@/lib/auth";
import type { AuthLoginAttempt } from "@/lib/auth-types";
import { getCollections } from "@/lib/collections";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;

const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(200)
});

export async function POST(request: Request) {
  try {
    const payload = loginSchema.parse(await request.json());
    const ip = getClientIp(request);
    const key = `${payload.email}:${ip}`;
    const { users, loginAttempts } = await getCollections();
    const now = new Date();
    const attempt = await loginAttempts.findOne({ key });

    if (attempt?.lockedUntil && new Date(attempt.lockedUntil) > now) {
      return NextResponse.json({ error: "Demasiados intentos. Intenta de nuevo en unos minutos." }, { status: 429 });
    }

    const user = await users.findOne({ email: payload.email, active: true });

    if (!user || !(await verifyPassword(payload.password, user.passwordHash))) {
      await recordFailedAttempt(key, payload.email, ip);
      return NextResponse.json({ error: "Email o contrasena incorrectos." }, { status: 401 });
    }

    await createSession(user);
    await loginAttempts.deleteOne({ key });
    await users.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date(), updatedAt: new Date() } });

    return NextResponse.json({ user: publicUser(user) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo iniciar sesion.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

async function recordFailedAttempt(key: string, email: string, ip: string) {
  const { loginAttempts } = await getCollections();
  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_MS);
  const current = await loginAttempts.findOne({ key });
  const attempts =
    current && new Date(current.firstAttemptAt) > windowStart ? current.attempts + 1 : 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCK_MS) : undefined;
  const update: UpdateFilter<AuthLoginAttempt> = {
    $set: {
      email,
      ip,
      attempts,
      firstAttemptAt: attempts === 1 ? now : current?.firstAttemptAt ?? now,
      updatedAt: now,
      ...(lockedUntil ? { lockedUntil } : {})
    },
    ...(lockedUntil ? {} : { $unset: { lockedUntil: true } })
  };

  await loginAttempts.updateOne(
    { key },
    update,
    { upsert: true }
  );
}

function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor || request.headers.get("x-real-ip") || "unknown";
}
