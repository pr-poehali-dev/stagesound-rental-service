-- Прокатчики (партнёры платформы)
CREATE TABLE t_p53739895_stagesound_rental_se.renters (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT 'Санкт-Петербург',
    telegram TEXT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Оборудование прокатчиков (на модерации)
CREATE TABLE t_p53739895_stagesound_rental_se.renter_equipment (
    id SERIAL PRIMARY KEY,
    renter_id INTEGER NOT NULL REFERENCES t_p53739895_stagesound_rental_se.renters(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    subcategory TEXT NULL,
    price INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'день',
    description TEXT NOT NULL DEFAULT '',
    specs JSONB NOT NULL DEFAULT '{}',
    tags TEXT[] NOT NULL DEFAULT '{}',
    image TEXT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ NULL
);

-- Уведомления прокатчика о заказах
CREATE TABLE t_p53739895_stagesound_rental_se.renter_order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES t_p53739895_stagesound_rental_se.orders(id),
    renter_id INTEGER NOT NULL REFERENCES t_p53739895_stagesound_rental_se.renters(id),
    renter_equipment_id INTEGER NOT NULL REFERENCES t_p53739895_stagesound_rental_se.renter_equipment(id),
    equipment_name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    days INTEGER NOT NULL DEFAULT 1,
    subtotal INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'new',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Сессионные токены прокатчиков
CREATE TABLE t_p53739895_stagesound_rental_se.renter_sessions (
    id SERIAL PRIMARY KEY,
    renter_id INTEGER NOT NULL REFERENCES t_p53739895_stagesound_rental_se.renters(id),
    token TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '30 days'
);

CREATE INDEX ON t_p53739895_stagesound_rental_se.renter_sessions(token);
CREATE INDEX ON t_p53739895_stagesound_rental_se.renter_equipment(renter_id);
CREATE INDEX ON t_p53739895_stagesound_rental_se.renter_order_items(renter_id);
CREATE INDEX ON t_p53739895_stagesound_rental_se.renter_order_items(order_id);
