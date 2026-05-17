# La Esquinita - Control de Gastos e Ingresos

Modulo mobile-first para registrar ordenes, gastos y rentabilidad simple de una cevicheria / negocio de comida en Costa Rica.

## Stack

- Next.js App Router
- React + TypeScript
- TailwindCSS v4
- shadcn/ui-style local components
- Framer Motion
- MongoDB Node.js Driver, sin Mongoose
- Recharts
- Dark/light mode
- Excel export with `exceljs`

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local`:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=la_esquinita
AUTH_BOOTSTRAP_EMAIL=dueno@laesquinita.com
AUTH_BOOTSTRAP_PASSWORD=change-this-secure-password
AUTH_BOOTSTRAP_NAME=La Esquinita
```

Create the first owner user explicitly:

```bash
npm run auth:bootstrap
```

The bootstrap command refuses to create a user if the `users` collection already has one.

## Main Routes

- `/` - business health dashboard
- `/api/products` - list/create products
- `/api/orders` - list/create income orders
- `/api/orders/next-number` - suggested consecutive order number
- `/api/expenses` - list/create expenses
- `/api/finance/summary` - dashboard analytics
- `/api/daily-notes` - daily owner note
- `/api/export` - Excel workbook export

## MongoDB Collections

`products`

```ts
{
  name: string;
  category: "Ceviche" | "Caldosa" | "Refrescos" | "Otros";
  defaultPrice: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

`orders`

```ts
{
  orderNumber: number;
  paymentMethod: "SINPE" | "Efectivo" | "Transferencia" | "Tarjeta";
  items: Array<{
    productId: string;
    productName: string;
    category: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  totalAmount: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

`expenses`

```ts
{
  amount: number;
  category: string;
  paymentMethod: "SINPE" | "Efectivo" | "Transferencia" | "Tarjeta";
  receiptNumber?: string;
  vendorName?: string;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Extra support collections:

- `counters` for atomic order numbers.
- `daily_notes` for optional daily owner notes.

## Project Structure

```text
app/
  api/
  globals.css
  layout.tsx
  page.tsx
components/
  finance/
  providers/
  ui/
hooks/
  use-finance-dashboard.ts
lib/
  collections.ts
  date-ranges.ts
  finance-analytics.ts
  finance-types.ts
  mongodb.ts
  seed-products.ts
  validators.ts
```

## Verification

```bash
npm run lint
npm run build
npm audit --audit-level=moderate
```
