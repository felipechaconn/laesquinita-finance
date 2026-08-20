const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const requiredEnv = [
  "TEST_CONTRACTOR_A_EMAIL",
  "TEST_CONTRACTOR_A_PASSWORD",
  "TEST_CONTRACTOR_B_EMAIL",
  "TEST_CONTRACTOR_B_PASSWORD",
  "TEST_ADMIN_EMAIL",
  "TEST_ADMIN_PASSWORD"
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    fail(`Missing ${key}. Run this only against staging/dev with explicit test users.`);
  }
}

const contractorA = await login(process.env.TEST_CONTRACTOR_A_EMAIL, process.env.TEST_CONTRACTOR_A_PASSWORD);
const contractorB = await login(process.env.TEST_CONTRACTOR_B_EMAIL, process.env.TEST_CONTRACTOR_B_PASSWORD);
const admin = await login(process.env.TEST_ADMIN_EMAIL, process.env.TEST_ADMIN_PASSWORD);
let createdOrderId = null;

try {
  const products = await request("/api/products", { cookie: contractorA.cookie });
  assert(products.response.status === 200, "contractor can read products");
  const product = products.data.find((item) => (item.kind ?? "sell") === "sell" && item.active);
  assert(product, "at least one active sell product exists");

  const created = await request("/api/orders", {
    method: "POST",
    cookie: contractorA.cookie,
    body: {
      paymentMethod: "SINPE",
      items: [{
        productId: String(product._id),
        productName: "tampered name",
        category: "Otros",
        quantity: 1,
        unitPrice: product.defaultPrice
      }]
    }
  });
  assert(created.response.status === 201, "contractor A can create today's order");
  createdOrderId = String(created.data._id);

  const contractorBOrders = await request("/api/orders?date=today&limit=100", { cookie: contractorB.cookie });
  assert(contractorBOrders.response.status === 200, "contractor B can read own today orders");
  assert(!contractorBOrders.data.some((order) => String(order._id) === createdOrderId), "contractor B cannot see contractor A order");

  const crossEdit = await request(`/api/orders/${createdOrderId}`, {
    method: "PATCH",
    cookie: contractorB.cookie,
    body: {
      paymentMethod: "SINPE",
      items: [{
        productId: String(product._id),
        productName: product.name,
        category: product.category,
        quantity: 2,
        unitPrice: product.defaultPrice
      }]
    }
  });
  assert(crossEdit.response.status === 403, "contractor B cannot edit contractor A order");

  const crossDelete = await request(`/api/orders/${createdOrderId}`, {
    method: "DELETE",
    cookie: contractorB.cookie
  });
  assert(crossDelete.response.status === 403, "contractor B cannot void contractor A order");

  const fakePrice = await request(`/api/orders/${createdOrderId}`, {
    method: "PATCH",
    cookie: contractorA.cookie,
    body: {
      paymentMethod: "SINPE",
      items: [{
        productId: String(product._id),
        productName: product.name,
        category: product.category,
        quantity: 1,
        unitPrice: product.defaultPrice + 1
      }]
    }
  });
  assert(fakePrice.response.status === 403, "contractor cannot change product price");

  const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const backdated = await request("/api/orders", {
    method: "POST",
    cookie: contractorA.cookie,
    body: {
      paymentMethod: "SINPE",
      createdAt: oldDate,
      items: [{
        productId: String(product._id),
        productName: product.name,
        category: product.category,
        quantity: 1,
        unitPrice: product.defaultPrice
      }]
    }
  });
  assert(backdated.response.status === 403, "contractor cannot create backdated order");

  for (const path of ["/api/finance/summary", "/api/expenses", "/api/providers", "/api/reports/daily", "/api/export"]) {
    const blocked = await request(path, { cookie: contractorA.cookie });
    assert(blocked.response.status === 403, `contractor blocked from ${path}`);
  }

  console.log("Security smoke tests passed.");
} finally {
  if (createdOrderId) {
    await request(`/api/orders/${createdOrderId}`, { method: "DELETE", cookie: admin.cookie });
  }
}

async function login(email, password) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await safeJson(response);
  assert(response.status === 200, `login succeeds for ${email}: ${data.error ?? response.status}`);
  const setCookie = response.headers.get("set-cookie") ?? "";
  const cookie = setCookie.split(";")[0];
  assert(cookie.startsWith("la_esquinita_session="), `session cookie returned for ${email}`);
  return { data, cookie };
}

async function request(path, { method = "GET", cookie, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  return { response, data: await safeJson(response) };
}

async function safeJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }

  console.log(`ok - ${message}`);
}

function fail(message) {
  console.error(`not ok - ${message}`);
  process.exit(1);
}
