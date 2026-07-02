CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    global_stock_threshold INTEGER NOT NULL DEFAULT 20,
    max_seller_discount_percentage DECIMAL(5, 2) NOT NULL DEFAULT 20.00,
    ticket_show_logo BOOLEAN NOT NULL DEFAULT FALSE,
    ticket_show_slogan BOOLEAN NOT NULL DEFAULT FALSE,
    ticket_footer_message VARCHAR(200) DEFAULT 'Merci pour votre achat !',
    ticket_width VARCHAR(10) DEFAULT '80mm' CHECK (ticket_width IN ('58mm', '80mm')),
    ticket_show_qr BOOLEAN NOT NULL DEFAULT FALSE,
    theme VARCHAR(10) NOT NULL DEFAULT 'dark' CHECK (theme IN ('dark', 'light')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
