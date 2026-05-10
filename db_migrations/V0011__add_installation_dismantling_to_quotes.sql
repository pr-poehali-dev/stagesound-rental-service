ALTER TABLE t_p53739895_stagesound_rental_se.quotes
  ADD COLUMN IF NOT EXISTS installation_time TEXT,
  ADD COLUMN IF NOT EXISTS installation_price INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dismantling_time TEXT,
  ADD COLUMN IF NOT EXISTS dismantling_price INTEGER NOT NULL DEFAULT 0;
