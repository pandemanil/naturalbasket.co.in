-- Editable starter catalogue. Every price, unit, description and stock value can be
-- changed later from the admin dashboard. Prices are integer paise (₹1 = 100).

INSERT INTO categories (name, slug, sort_order) VALUES
  ('Traditional Snacks', 'traditional-snacks', 1),
  ('Milk Products', 'milk-products', 2),
  ('Fresh Vegetables & Greens', 'fresh-vegetables-greens', 3),
  ('Cooking Oils', 'cooking-oils', 4),
  ('Premium Spices', 'premium-spices', 5);

INSERT INTO settings (key, value) VALUES
  ('delivery_charge_paise', '0'),   -- 0 = delivery charge confirmed on chat; set e.g. 3000 for ₹30
  ('min_order_paise', '0'),         -- 0 = no minimum order; set e.g. 20000 for ₹200
  ('store_open', '1');

-- Traditional Snacks
INSERT INTO products (name, slug, description, category_id, price_paise, unit, stock_quantity, is_featured) VALUES
  ('Millet Energy Bar', 'millet-energy-bar', 'Sample description — edit in admin.', 1, 5000, 'per piece', 25, 1),
  ('Traditional Murkulu', 'traditional-murkulu', 'Sample description — edit in admin.', 1, 15000, 'per 200 g', 25, 0),
  ('Handmade Athrasalu', 'handmade-athrasalu', 'Sample description — edit in admin.', 1, 20000, 'per 150 g', 25, 1),
  ('Handmade Banana Chips', 'handmade-banana-chips', 'Sample description — edit in admin.', 1, 9000, 'per 100 g', 25, 0);

-- Milk Products
INSERT INTO products (name, slug, description, category_id, price_paise, unit, stock_quantity, is_featured) VALUES
  ('A2 Desi Cow Milk', 'a2-desi-cow-milk', 'Sample description — edit in admin.', 2, 7500, 'per litre', 20, 1),
  ('Fresh Buffalo Milk', 'fresh-buffalo-milk', 'Sample description — edit in admin.', 2, 8500, 'per litre', 20, 0),
  ('Homemade Curd', 'homemade-curd', 'Sample description — edit in admin.', 2, 6000, 'per 500 g', 15, 0),
  ('Pure Desi Cow Ghee', 'pure-desi-cow-ghee', 'Sample description — edit in admin.', 2, 65000, 'per 250 g', 10, 1),
  ('Pure Buffalo Ghee', 'pure-buffalo-ghee', 'Sample description — edit in admin.', 2, 70000, 'per 250 g', 10, 0);

-- Fresh Vegetables & Greens
INSERT INTO products (name, slug, description, category_id, price_paise, unit, stock_quantity, is_featured) VALUES
  ('Farm Tomatoes', 'farm-tomatoes', 'Sample description — edit in admin.', 3, 6500, 'per kg', 30, 0),
  ('Fresh Carrots', 'fresh-carrots', 'Sample description — edit in admin.', 3, 5000, 'per kg', 30, 0),
  ('Red Onions', 'red-onions', 'Sample description — edit in admin.', 3, 4000, 'per kg', 30, 0),
  ('Spinach Bunch', 'spinach-bunch', 'Sample description — edit in admin.', 3, 4000, 'per bunch', 30, 0);

-- Cooking Oils
INSERT INTO products (name, slug, description, category_id, price_paise, unit, stock_quantity, is_featured) VALUES
  ('Cold-Pressed Groundnut Oil', 'cold-pressed-groundnut-oil', 'Sample description — edit in admin.', 4, 29000, 'per litre', 12, 1),
  ('Organic Sunflower Oil', 'organic-sunflower-oil', 'Sample description — edit in admin.', 4, 22000, 'per litre', 12, 0);

-- Premium Spices
INSERT INTO products (name, slug, description, category_id, price_paise, unit, stock_quantity, is_featured) VALUES
  ('Organic Turmeric Powder', 'organic-turmeric-powder', 'Sample description — edit in admin.', 5, 18000, 'per 200 g', 25, 1),
  ('Cumin Seeds', 'cumin-seeds', 'Sample description — edit in admin.', 5, 9000, 'per 100 g', 25, 0);
