-- Коммерческие предложения (КП), собираемые менеджером
CREATE TABLE IF NOT EXISTS quotes (
    id          SERIAL PRIMARY KEY,
    token       TEXT UNIQUE NOT NULL,                -- уникальный токен для ссылки клиенту
    title       TEXT NOT NULL DEFAULT '',            -- название/комментарий КП
    items       JSONB NOT NULL DEFAULT '[]',         -- [{id, name, price, qty, unit}]
    days        INTEGER NOT NULL DEFAULT 1,
    delivery    TEXT NOT NULL DEFAULT '',
    delivery_price INTEGER NOT NULL DEFAULT 0,
    extras      JSONB NOT NULL DEFAULT '[]',         -- [{id, name, price}]
    total       INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'draft',       -- draft | sent | approved | contracted
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at     TIMESTAMPTZ
);

-- Договоры, заполняемые клиентами по ссылке
CREATE TABLE IF NOT EXISTS contracts (
    id              SERIAL PRIMARY KEY,
    quote_id        INTEGER NOT NULL REFERENCES quotes(id),
    client_type     TEXT NOT NULL,                  -- 'individual' | 'company'
    -- Физ. лицо
    full_name       TEXT NOT NULL DEFAULT '',
    passport_series TEXT NOT NULL DEFAULT '',
    passport_number TEXT NOT NULL DEFAULT '',
    passport_issued TEXT NOT NULL DEFAULT '',
    passport_date   TEXT NOT NULL DEFAULT '',
    birth_date      TEXT NOT NULL DEFAULT '',
    address         TEXT NOT NULL DEFAULT '',
    -- Юр. лицо
    company_name    TEXT NOT NULL DEFAULT '',
    inn             TEXT NOT NULL DEFAULT '',
    kpp             TEXT NOT NULL DEFAULT '',
    ogrn            TEXT NOT NULL DEFAULT '',
    legal_address   TEXT NOT NULL DEFAULT '',
    director        TEXT NOT NULL DEFAULT '',
    -- Общие контакты
    phone           TEXT NOT NULL DEFAULT '',
    email           TEXT NOT NULL DEFAULT '',
    -- Файл паспорта (S3 URL)
    passport_file_url TEXT,
    -- Статус
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | reviewed
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
