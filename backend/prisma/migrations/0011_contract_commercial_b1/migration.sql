-- Contract commercial fields (B1): multi service types + payment terms.
ALTER TABLE contracts.contracts
  ADD COLUMN IF NOT EXISTS service_types TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE contracts.contracts
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;

-- Backfill array from legacy single service_type when empty.
UPDATE contracts.contracts
SET service_types = ARRAY[service_type]
WHERE cardinality(service_types) = 0
  AND service_type IS NOT NULL
  AND btrim(service_type) <> '';
