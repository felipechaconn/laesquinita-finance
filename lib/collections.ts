import type { Collection, Db } from "mongodb";

import type { AuthLoginAttempt, AuthSession, AuthUser } from "@/lib/auth-types";
import type { DailyNote, Expense, Order, Product } from "@/lib/finance-types";
import { getDb } from "@/lib/mongodb";

let indexesCreated = false;

export async function getCollections() {
  const db = await getDb();
  await ensureIndexes(db);

  return {
    products: db.collection<Product>("products"),
    orders: db.collection<Order>("orders"),
    expenses: db.collection<Expense>("expenses"),
    dailyNotes: db.collection<DailyNote>("daily_notes"),
    users: db.collection<AuthUser>("users"),
    sessions: db.collection<AuthSession>("sessions"),
    loginAttempts: db.collection<AuthLoginAttempt>("login_attempts"),
    counters: db.collection<{ _id: string; seq: number }>("counters")
  };
}

async function ensureIndexes(db: Db) {
  if (indexesCreated) {
    return;
  }

  await Promise.all([
    db.collection("products").createIndexes([
      { key: { name: 1 }, name: "product_name" },
      { key: { category: 1, active: 1 }, name: "product_category_active" },
      { key: { kind: 1, active: 1, name: 1 }, name: "product_kind_active_name" },
      { key: { deletedAt: 1 }, name: "product_deleted_at" }
    ]),
    db.collection("orders").createIndexes([
      { key: { orderNumber: 1 }, unique: true, name: "order_number_unique" },
      { key: { createdAt: -1 }, name: "orders_created_at" },
      { key: { paymentMethod: 1, createdAt: -1 }, name: "orders_payment_created" },
      { key: { "items.productId": 1 }, name: "orders_item_product" },
      { key: { deletedAt: 1 }, name: "orders_deleted_at" }
    ]),
    db.collection("expenses").createIndexes([
      { key: { createdAt: -1 }, name: "expenses_created_at" },
      { key: { category: 1, createdAt: -1 }, name: "expenses_category_created" },
      { key: { paymentMethod: 1, createdAt: -1 }, name: "expenses_payment_created" },
      { key: { deletedAt: 1 }, name: "expenses_deleted_at" }
    ]),
    db.collection("daily_notes").createIndex({ dateKey: 1 }, { unique: true, name: "daily_note_date" })
    ,
    db.collection("users").createIndexes([
      { key: { email: 1 }, unique: true, name: "user_email_unique" },
      { key: { active: 1 }, name: "user_active" }
    ]),
    db.collection("sessions").createIndexes([
      { key: { tokenHash: 1 }, unique: true, name: "session_token_unique" },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0, name: "session_expiry_ttl" },
      { key: { userId: 1 }, name: "session_user" }
    ]),
    db.collection("login_attempts").createIndexes([
      { key: { key: 1 }, unique: true, name: "login_attempt_key_unique" },
      { key: { updatedAt: 1 }, expireAfterSeconds: 3600, name: "login_attempt_cleanup_ttl" }
    ])
  ]);

  indexesCreated = true;
}

export async function nextOrderNumber(counters: Collection<{ _id: string; seq: number }>) {
  const result = await counters.findOneAndUpdate(
    { _id: "orders" },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  return result?.seq ?? 1;
}
