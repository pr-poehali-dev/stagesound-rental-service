CREATE TABLE equipment (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'день',
  rating NUMERIC(2,1) NOT NULL DEFAULT 5,
  reviews INTEGER NOT NULL DEFAULT 0,
  popular BOOLEAN NOT NULL DEFAULT false,
  specs JSONB NOT NULL DEFAULT '{}',
  description TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  image TEXT,
  usage TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE subcategories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE(name, category)
);

INSERT INTO categories (name, sort_order) VALUES
  ('Звук', 1),
  ('Свет', 2),
  ('Видео', 3),
  ('Сцена', 4),
  ('Конференц', 5),
  ('Генераторы', 6);

INSERT INTO subcategories (name, category, sort_order) VALUES
  ('Комплекты звука', 'Звук', 1),
  ('Колонки и сабвуферы', 'Звук', 2),
  ('Микрофоны', 'Звук', 3),
  ('Микшерные пульты', 'Звук', 4);
