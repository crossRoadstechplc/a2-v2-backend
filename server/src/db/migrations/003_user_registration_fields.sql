-- Add registration fields: first_name, last_name, company_name
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name TEXT;
ALTER TABLE users ADD COLUMN company_name TEXT;

-- Migrate existing name to first_name (keep name for backward compat)
UPDATE users SET first_name = name WHERE first_name IS NULL AND name IS NOT NULL;
