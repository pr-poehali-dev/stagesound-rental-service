ALTER TABLE t_p53739895_stagesound_rental_se.quotes ADD COLUMN IF NOT EXISTS delivery_time TEXT;
ALTER TABLE t_p53739895_stagesound_rental_se.quotes ADD COLUMN IF NOT EXISTS pickup_time TEXT;
ALTER TABLE t_p53739895_stagesound_rental_se.quotes ADD COLUMN IF NOT EXISTS no_installation BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE t_p53739895_stagesound_rental_se.quotes ADD COLUMN IF NOT EXISTS discount INTEGER NOT NULL DEFAULT 0;
