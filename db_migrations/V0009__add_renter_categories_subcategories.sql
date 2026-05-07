-- Категории, предлагаемые прокатчиками (на модерации)
CREATE TABLE t_p53739895_stagesound_rental_se.renter_categories (
    id SERIAL PRIMARY KEY,
    renter_id INTEGER NOT NULL REFERENCES t_p53739895_stagesound_rental_se.renters(id),
    name TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ NULL
);

-- Подкатегории, предлагаемые прокатчиками (на модерации)
CREATE TABLE t_p53739895_stagesound_rental_se.renter_subcategories (
    id SERIAL PRIMARY KEY,
    renter_id INTEGER NOT NULL REFERENCES t_p53739895_stagesound_rental_se.renters(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_at TIMESTAMPTZ NULL
);

CREATE INDEX ON t_p53739895_stagesound_rental_se.renter_categories(renter_id);
CREATE INDEX ON t_p53739895_stagesound_rental_se.renter_subcategories(renter_id);
