-- Поля для ПЭП (простая электронная подпись) и просмотра/скачивания договора
ALTER TABLE t_p53739895_stagesound_rental_se.contracts
  ADD COLUMN IF NOT EXISTS otp_code       TEXT,
  ADD COLUMN IF NOT EXISTS otp_sent_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS otp_attempts   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS signed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_ip   TEXT,
  ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;
