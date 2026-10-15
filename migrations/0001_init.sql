-- Natural Basket schema. All money is stored as INTEGER paise (1 rupee = 100 paise).

CREATE TABLE categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  slug        TEXT NOT NULL UNIQUE,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE products (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  category_id     INTEGER NOT NULL REFERENCES categories(id),
  price_paise     INTEGER NOT NULL CHECK (price_paise >= 0 AND price_paise <= 10000000),
  unit            TEXT NOT NULL CHECK (length(unit) BETWEEN 2 AND 40),
  image_key       TEXT,                       -- R2 object key, NULL = placeholder
  stock_quantity  INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_available    INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1)),
  is_featured     INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  is_on_offer     INTEGER NOT NULL DEFAULT 0 CHECK (is_on_offer IN (0, 1)),
  is_hidden       INTEGER NOT NULL DEFAULT 0 CHECK (is_hidden IN (0, 1)),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_visible ON products(is_hidden, is_available);

CREATE TABLE settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE orders (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number     TEXT NOT NULL UNIQUE,
  -- An order REQUEST starts as 'pending'. Only an admin moves it forward.
  -- No payment status exists: payment is not collected online yet.
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','confirmed','out_for_delivery','delivered','cancelled')),
  customer_name    TEXT NOT NULL CHECK (length(customer_name) BETWEEN 2 AND 100),
  mobile           TEXT NOT NULL CHECK (length(mobile) = 10),
  address          TEXT NOT NULL CHECK (length(address) BETWEEN 10 AND 500),
  city             TEXT NOT NULL,
  pincode          TEXT NOT NULL CHECK (length(pincode) = 6),
  notes            TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  subtotal_paise   INTEGER NOT NULL CHECK (subtotal_paise >= 0),
  delivery_paise   INTEGER NOT NULL CHECK (delivery_paise >= 0),
  total_paise      INTEGER NOT NULL CHECK (total_paise >= 0),
  idempotency_key  TEXT NOT NULL UNIQUE,      -- blocks duplicate submissions
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_status ON orders(status, created_at);

CREATE TABLE order_items (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id           INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id         INTEGER NOT NULL REFERENCES products(id),
  product_name       TEXT NOT NULL,           -- snapshot at order time
  unit               TEXT NOT NULL,
  unit_price_paise   INTEGER NOT NULL CHECK (unit_price_paise >= 0),  -- server-verified
  quantity           INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 50),
  line_total_paise   INTEGER NOT NULL CHECK (line_total_paise >= 0)
);
CREATE INDEX idx_order_items_order ON order_items(order_id);
