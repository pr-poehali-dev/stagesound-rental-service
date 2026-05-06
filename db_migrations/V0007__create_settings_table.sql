CREATE TABLE IF NOT EXISTS t_p53739895_stagesound_rental_se.settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  label VARCHAR(200),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO t_p53739895_stagesound_rental_se.settings (key, value, label) VALUES
  ('phone', '+7 (812) 123-45-67', 'Номер телефона'),
  ('phone_raw', '+78121234567', 'Номер телефона (для ссылки tel:)'),
  ('email', 'info@stagesound.ru', 'Email'),
  ('address', 'Санкт-Петербург, Невский пр., 88', 'Адрес'),
  ('workdays', 'Пн–Пт: 9:00 — 20:00', 'Режим работы (будни)'),
  ('weekend', 'Сб–Вс: 10:00 — 17:00', 'Режим работы (выходные)'),
  ('telegram', 'https://t.me/stagesound', 'Ссылка Telegram'),
  ('whatsapp', '', 'Номер WhatsApp (только цифры)'),
  ('vk', '', 'Ссылка ВКонтакте'),
  ('company_name', 'StageSound', 'Название компании')
ON CONFLICT (key) DO NOTHING;
