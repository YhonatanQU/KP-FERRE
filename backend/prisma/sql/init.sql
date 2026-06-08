-- Base initialization script for PostgreSQL.
-- Prisma migrations create the ERP tables.
-- This script enables common extensions used in many setups.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
