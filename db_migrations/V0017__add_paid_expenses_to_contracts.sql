ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS paid        boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_at     timestamptz,
  ADD COLUMN IF NOT EXISTS expenses    jsonb     NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS expenses_total numeric(12,2) NOT NULL DEFAULT 0;
