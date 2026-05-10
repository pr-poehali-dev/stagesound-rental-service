ALTER TABLE t_p53739895_stagesound_rental_se.equipment
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]';

ALTER TABLE t_p53739895_stagesound_rental_se.renter_equipment
  ADD COLUMN IF NOT EXISTS variants JSONB NOT NULL DEFAULT '[]';
