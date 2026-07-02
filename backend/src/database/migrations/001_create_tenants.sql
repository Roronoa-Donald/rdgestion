CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    owner_name VARCHAR(80) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(100),
    address TEXT,
    city VARCHAR(80),
    country VARCHAR(80),
    currency VARCHAR(10) NOT NULL DEFAULT 'FCFA',
    logo_url VARCHAR(255),
    slogan VARCHAR(200),
    tax_number VARCHAR(50),
    timezone VARCHAR(50) DEFAULT 'Africa/Lome',
    referral_code VARCHAR(30) UNIQUE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_phone ON tenants(phone);
CREATE INDEX IF NOT EXISTS idx_tenants_referral_code ON tenants(referral_code);
