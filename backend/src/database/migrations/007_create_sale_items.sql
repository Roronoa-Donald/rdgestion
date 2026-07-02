CREATE TABLE IF NOT EXISTS sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    product_name VARCHAR(150) NOT NULL, -- Snapshot du nom au moment de la vente
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_purchase_price DECIMAL(12, 2) NOT NULL, -- Snapshot du prix d'achat
    unit_sell_price DECIMAL(12, 2) NOT NULL, -- Snapshot du prix de vente
    total_price DECIMAL(12, 2) NOT NULL,
    profit DECIMAL(12, 2) -- (sell_price - purchase_price) * quantity
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
