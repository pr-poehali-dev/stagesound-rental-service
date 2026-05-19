CREATE TABLE IF NOT EXISTS staff (
    id          serial PRIMARY KEY,
    name        text NOT NULL,
    email       text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role        text NOT NULL DEFAULT 'manager',
    is_active   boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE quotes
    ADD COLUMN IF NOT EXISTS staff_id integer;

ALTER TABLE contracts
    ADD COLUMN IF NOT EXISTS staff_id integer;

CREATE TABLE IF NOT EXISTS staff_sessions (
    id          serial PRIMARY KEY,
    staff_id    integer NOT NULL,
    token       text NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL DEFAULT now() + interval '30 days',
    created_at  timestamptz NOT NULL DEFAULT now()
);
