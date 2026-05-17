import type { ObjectId } from "mongodb";

export type UserRole = "owner" | "staff";

export type AuthUser = {
  _id?: ObjectId | string;
  email: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  active: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastLoginAt?: Date | string;
};

export type AuthSession = {
  _id?: ObjectId | string;
  userId: ObjectId | string;
  tokenHash: string;
  expiresAt: Date | string;
  createdAt: Date | string;
  lastSeenAt: Date | string;
};

export type AuthLoginAttempt = {
  _id?: ObjectId | string;
  key: string;
  email: string;
  ip: string;
  attempts: number;
  firstAttemptAt: Date | string;
  updatedAt: Date | string;
  lockedUntil?: Date | string;
};
