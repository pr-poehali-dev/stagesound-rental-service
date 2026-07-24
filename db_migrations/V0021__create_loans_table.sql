CREATE TABLE IF NOT EXISTS loans (
    id SERIAL PRIMARY KEY,
    token TEXT NOT NULL UNIQUE,
    -- Условия займа (задаёт админ)
    amount NUMERIC(14,2) NOT NULL DEFAULT 0,
    interest_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
    issue_date DATE,
    return_date DATE,
    doc_number TEXT,
    -- Реквизиты заёмщика (заполняются по ссылке)
    borrower_type TEXT NOT NULL DEFAULT 'individual',
    full_name TEXT NOT NULL DEFAULT '',
    passport_series TEXT NOT NULL DEFAULT '',
    passport_number TEXT NOT NULL DEFAULT '',
    passport_issued TEXT NOT NULL DEFAULT '',
    passport_date TEXT NOT NULL DEFAULT '',
    birth_date TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    inn TEXT NOT NULL DEFAULT '',
    kpp TEXT NOT NULL DEFAULT '',
    ogrn TEXT NOT NULL DEFAULT '',
    legal_address TEXT NOT NULL DEFAULT '',
    director TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    -- Статус и результат
    status TEXT NOT NULL DEFAULT 'draft',
    pdf_url TEXT,
    filled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loans_token ON loans(token);