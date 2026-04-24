CREATE TABLE t_p53739895_stagesound_rental_se.orders (
  id SERIAL PRIMARY KEY,
  name TEXT,
  phone TEXT,
  date TEXT,
  place TEXT,
  comment TEXT,
  items JSONB,
  days INTEGER,
  delivery TEXT,
  extras JSONB,
  total INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);