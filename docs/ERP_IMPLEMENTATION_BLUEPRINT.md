# ERP Implementation Blueprint (Phase 1)

## 1) Scope and goal

Build a production-ready ERP web app from the current UI prototype, prioritizing:

- Sales (`cotizacion -> venta`)
- Purchases
- Inventory (real-time stock + kardex)
- Cashflow (auto income/expense ledger)

This blueprint defines the first implementation contract:

- Target architecture
- Data model
- Transactional business rules
- API v1 contracts
- Delivery order by phase

## 2) Target architecture

### Frontend (already started)

- Stack: Vite + React + TypeScript
- Keep current route structure and UI modules.
- Replace mock arrays with API data via a service layer (`src/app/services/*`).

### Backend (recommended)

- Runtime: Node.js + TypeScript
- Framework: Fastify (or Express if preferred)
- Validation: Zod
- ORM: Prisma
- DB: PostgreSQL
- Auth: JWT (access + refresh)
- Audit: created/updated timestamps + user ids on all transactional entities

### System modules

- `auth`
- `catalog` (products, categories)
- `crm` (clients, suppliers)
- `sales`
- `purchases`
- `inventory`
- `cashflow`
- `reports`

## 3) Core business flows

### Sales flow

1. Create quote (`cotizacion`) with line items.
2. Approve/convert quote to `venta` OR create direct sale.
3. Confirm sale:
- decrement inventory stock
- create inventory movement (`SALIDA`)
- create cashflow movement (`INGRESO`) if payment is immediate
4. Optionally generate invoice/receipt reference.

### Purchase flow

1. Create purchase order to supplier.
2. Confirm purchase reception.
3. Confirm purchase:
- increment inventory stock
- create inventory movement (`ENTRADA`)
- create cashflow movement (`EGRESO`) if paid

### Inventory flow

- Keep product stock denormalized in `products.stock_current`.
- Every stock change must also create `inventory_movements`.
- Kardex is generated from movement history.

### Cashflow flow

- Book entries from sales and purchases automatically.
- Allow manual entries (income/expense).
- Keep running balance per account/cashbox.

## 4) Data model (MVP)

### `users`

- `id` (uuid, pk)
- `name`
- `email` (unique)
- `password_hash`
- `role` (`admin`, `seller`, `buyer`, `warehouse`, `finance`)
- `is_active`
- `created_at`, `updated_at`

### `clients`

- `id` (uuid, pk)
- `doc_type` (`DNI`, `RUC`, `OTHER`)
- `doc_number` (indexed)
- `name`
- `email`, `phone`
- `address`, `city`, `region`
- `is_active`
- `created_at`, `updated_at`

### `suppliers`

- `id` (uuid, pk)
- `ruc` (indexed)
- `name`
- `contact_name`
- `email`, `phone`
- `address`, `city`, `region`
- `is_active`
- `created_at`, `updated_at`

### `categories`

- `id` (uuid, pk)
- `name` (unique)
- `description`
- `is_active`

### `products`

- `id` (uuid, pk)
- `sku` (unique)
- `name`
- `category_id` (fk)
- `brand`, `model`
- `cost_price`
- `sale_price`
- `stock_current`
- `stock_min`
- `stock_max`
- `location_code`
- `is_active`
- `created_at`, `updated_at`

### `quotes`

- `id` (uuid, pk)
- `number` (unique, readable: `Q-2026-0001`)
- `client_id` (fk)
- `status` (`DRAFT`, `SENT`, `APPROVED`, `REJECTED`, `EXPIRED`, `CONVERTED`)
- `issue_date`
- `expiry_date`
- `subtotal`, `tax_total`, `discount_total`, `grand_total`
- `notes`
- `created_by` (fk users)
- `created_at`, `updated_at`

### `quote_items`

- `id` (uuid, pk)
- `quote_id` (fk)
- `product_id` (fk)
- `qty`
- `unit_price`
- `discount_pct`
- `tax_pct`
- `line_subtotal`
- `line_total`

### `sales`

- `id` (uuid, pk)
- `number` (unique: `V-2026-0001`)
- `source_quote_id` (nullable fk)
- `client_id` (fk)
- `status` (`DRAFT`, `CONFIRMED`, `CANCELLED`)
- `payment_status` (`PENDING`, `PARTIAL`, `PAID`)
- `payment_method` (`CASH`, `TRANSFER`, `YAPE`, `PLIN`, `CARD`, `MIXED`)
- `sale_date`
- `subtotal`, `tax_total`, `discount_total`, `grand_total`
- `notes`
- `created_by` (fk users)
- `created_at`, `updated_at`

### `sale_items`

- `id` (uuid, pk)
- `sale_id` (fk)
- `product_id` (fk)
- `qty`
- `unit_price`
- `discount_pct`
- `tax_pct`
- `line_subtotal`
- `line_total`

### `purchases`

- `id` (uuid, pk)
- `number` (unique: `C-2026-0001`)
- `supplier_id` (fk)
- `status` (`DRAFT`, `ORDERED`, `RECEIVED`, `CANCELLED`)
- `payment_status` (`PENDING`, `PARTIAL`, `PAID`)
- `payment_method` (`CASH`, `TRANSFER`, `CARD`, `OTHER`)
- `purchase_date`
- `subtotal`, `tax_total`, `discount_total`, `grand_total`
- `notes`
- `created_by` (fk users)
- `created_at`, `updated_at`

### `purchase_items`

- `id` (uuid, pk)
- `purchase_id` (fk)
- `product_id` (fk)
- `qty`
- `unit_cost`
- `discount_pct`
- `tax_pct`
- `line_subtotal`
- `line_total`

### `inventory_movements`

- `id` (uuid, pk)
- `product_id` (fk)
- `movement_type` (`ENTRADA`, `SALIDA`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`)
- `reason` (`SALE`, `PURCHASE`, `ADJUSTMENT`, `RETURN`)
- `reference_type` (`SALE`, `PURCHASE`, `MANUAL`)
- `reference_id` (uuid nullable)
- `qty`
- `stock_before`
- `stock_after`
- `unit_cost_snapshot`
- `notes`
- `created_by` (fk users)
- `created_at`

### `cash_accounts`

- `id` (uuid, pk)
- `name` (`Caja principal`, `Banco BCP`, etc.)
- `type` (`CASH`, `BANK`, `E_WALLET`)
- `currency` (`PEN`)
- `opening_balance`
- `is_active`

### `cash_movements`

- `id` (uuid, pk)
- `account_id` (fk cash_accounts)
- `movement_type` (`INGRESO`, `EGRESO`)
- `category` (`VENTA`, `COMPRA`, `NOMINA`, `SERVICIO`, `OTRO`)
- `description`
- `amount`
- `running_balance`
- `reference_type` (`SALE`, `PURCHASE`, `MANUAL`)
- `reference_id` (uuid nullable)
- `movement_date`
- `created_by` (fk users)
- `created_at`

## 5) Critical transactional rules

1. Sale confirmation is atomic:
- create sale + items
- update product stock
- insert inventory movements
- insert cash movement (if paid)
- fail all if one step fails

2. Purchase confirmation is atomic:
- create purchase + items
- update product stock
- insert inventory movements
- insert cash movement (if paid)

3. `products.stock_current` must always equal the sum of all movements for that product.

4. No stock can go negative on confirmed sales.

5. Quote conversion is one-way:
- converted quote cannot be edited as active quote.

## 6) API v1 contracts (MVP)

### Auth

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Catalog

- `GET /api/v1/categories`
- `POST /api/v1/categories`
- `GET /api/v1/products`
- `GET /api/v1/products/:id`
- `POST /api/v1/products`
- `PATCH /api/v1/products/:id`

### CRM

- `GET /api/v1/clients`
- `POST /api/v1/clients`
- `PATCH /api/v1/clients/:id`
- `GET /api/v1/suppliers`
- `POST /api/v1/suppliers`
- `PATCH /api/v1/suppliers/:id`

### Sales

- `GET /api/v1/quotes`
- `POST /api/v1/quotes`
- `POST /api/v1/quotes/:id/convert`
- `GET /api/v1/sales`
- `POST /api/v1/sales`
- `POST /api/v1/sales/:id/confirm`
- `POST /api/v1/sales/:id/cancel`

### Purchases

- `GET /api/v1/purchases`
- `POST /api/v1/purchases`
- `POST /api/v1/purchases/:id/confirm`
- `POST /api/v1/purchases/:id/cancel`

### Inventory

- `GET /api/v1/inventory/stock`
- `GET /api/v1/inventory/movements`
- `POST /api/v1/inventory/adjustments`
- `GET /api/v1/inventory/kardex/:productId`

### Cashflow

- `GET /api/v1/cash/accounts`
- `GET /api/v1/cash/movements`
- `POST /api/v1/cash/movements/manual`
- `GET /api/v1/cash/summary`

### Reports

- `GET /api/v1/reports/dashboard`
- `GET /api/v1/reports/sales`
- `GET /api/v1/reports/purchases`
- `GET /api/v1/reports/inventory`
- `GET /api/v1/reports/cashflow`

## 7) Frontend integration contract

Replace local mock arrays with:

- `services` layer for fetch calls
- typed DTOs/interfaces in `src/app/types`
- `query` state management (React Query recommended)
- table states: loading, empty, error, success

Create folders:

- `src/app/services`
- `src/app/types`
- `src/app/hooks`
- `src/app/constants`

## 8) Delivery roadmap (execution order)

### Milestone A - Foundation

- Create backend project + DB + migrations
- Implement auth + users + base middleware
- Seed demo data

### Milestone B - Master data

- Products, categories, clients, suppliers CRUD
- Replace frontend mocks for these modules

### Milestone C - Transactions

- Quotes + sales confirmation with stock/cash automation
- Purchases confirmation with stock/cash automation

### Milestone D - Operations

- Inventory movements + kardex + manual adjustments
- Cashflow ledger + summaries

### Milestone E - Analytics

- Dashboard KPIs and report endpoints
- Export CSV/PDF

## 9) Immediate next step (Phase 2 start)

Implement backend skeleton and DB schema first, then wire one full vertical slice:

- `products CRUD`
- `sales confirm transaction`
- `inventory movement creation`
- `cash movement creation`

That slice validates end-to-end architecture before scaling to all modules.
