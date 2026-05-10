-- Поля подписи менеджера
ALTER TABLE t_p53739895_stagesound_rental_se.contracts
  ADD COLUMN IF NOT EXISTS manager_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS manager_name      TEXT,
  ADD COLUMN IF NOT EXISTS pep_uid           TEXT;

-- Шаблон договора (редактируемые разделы)
CREATE TABLE IF NOT EXISTS t_p53739895_stagesound_rental_se.contract_template (
  id         SERIAL PRIMARY KEY,
  section    TEXT NOT NULL UNIQUE,
  content    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Реквизиты компании-арендодателя
INSERT INTO t_p53739895_stagesound_rental_se.settings (key, value, label) VALUES
  ('company_name',    'ООО «Global Renta»',                     'Название компании'),
  ('company_inn',     '',                                        'ИНН'),
  ('company_kpp',     '',                                        'КПП'),
  ('company_ogrn',    '',                                        'ОГРН'),
  ('company_address', 'г. Санкт-Петербург, Невский пр., 88',    'Юридический адрес'),
  ('company_bank',    '',                                        'Банк'),
  ('company_bik',     '',                                        'БИК'),
  ('company_rs',      '',                                        'Расчётный счёт'),
  ('company_ks',      '',                                        'Корр. счёт'),
  ('company_director','',                                        'Директор (ФИО)'),
  ('company_email',   'info@global.promo',                      'Email компании'),
  ('company_phone',   '',                                        'Телефон компании')
ON CONFLICT (key) DO NOTHING;

-- Дефолтный шаблон договора
INSERT INTO t_p53739895_stagesound_rental_se.contract_template (section, content) VALUES
  ('section_1_extra', ''),
  ('section_2_extra', '2.3. Настоящий Договор является основанием для оказания услуг.'),
  ('section_3_extra', '3.4. Арендодатель вправе потребовать досрочного возврата Оборудования при нарушении условий настоящего Договора.'),
  ('section_4_extra', ''),
  ('section_5_extra', '5.4. Все изменения к настоящему Договору оформляются письменными дополнительными соглашениями.')
ON CONFLICT (section) DO NOTHING;
