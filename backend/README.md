# ERP Backend

## Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies:

```bash
npm install
```

3. Initialize database (container + connection check + SQL init + migrations + seed):

```bash
npm run db:init
```

4. Start dev server:

```bash
npm run dev
```

## Manual DB flow

1. Start PostgreSQL:

```bash
npm run db:up
```

2. Wait/check DB connection:

```bash
npm run db:check
```

3. Run SQL initialization:

```bash
npm run db:init:sql
```

4. Generate Prisma client and run migrations + seed:

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

## Health check

`GET /api/v1/health`
`GET /api/v1/health/db`
