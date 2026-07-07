// =============================================================================
// RDGESTION — Types des modèles de données
// Correspondance directe avec le schéma PostgreSQL (08_Base_de_donnees.md)
// =============================================================================

// --- Enums ---

export type UserRole = 'SUPERADMIN' | 'ADMIN' | 'SELLER';

export type SubscriptionTier = 'FREE' | 'PRO';

export type SubscriptionBillingType = 'MONTHLY' | 'LIFETIME';

export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export type ActivationMethod = 'AUTO' | 'MANUAL' | 'FEDAPAY' | 'REFERRAL';

export type PaymentMethod = 'CASH' | 'MOBILE_MONEY';

export type DiscountType = 'FIXED' | 'PERCENTAGE';

export type ReferralStatus = 'PENDING' | 'COMPLETED' | 'REWARDED';

export type TicketWidth = '58mm' | '80mm';

export type Theme = 'dark' | 'light';

export type NotificationType =
  | 'STOCK_LOW'
  | 'STOCK_OUT'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'REFERRAL_PENDING'
  | 'REFERRAL_COMPLETED'
  | 'REFERRAL_REWARD'
  | 'DAILY_LIMIT_WARNING'
  | 'SECURITY_NEW_DEVICE'
  | 'PRODUCT_EXPIRING';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'USER_CREATED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_UPDATE'
  | 'USER_PASSWORD_RESET'
  | 'PRODUCT_ADD'
  | 'PRODUCT_UPDATE'
  | 'PRODUCT_DELETE'
  | 'PRODUCT_RESTORE'
  | 'STOCK_DECREMENT'
  | 'STOCK_INCREMENT'
  | 'STOCK_ADJUSTMENT'
  | 'SALE_CREATE'
  | 'SALE_CANCEL'
  | 'SALE_TICKET_PRINT'
  | 'SALE_TICKET_REPRINT'
  | 'SETTINGS_UPDATE'
  | 'TICKET_SETTINGS_UPDATE'
  | 'CATEGORY_CREATED'
  | 'CATEGORY_DELETED'
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'REFERRAL_CREATED'
  | 'REFERRAL_COMPLETED'
  | 'REFERRAL_REWARD_GRANTED'
  | 'TENANT_CREATED'
  | 'EXPORT_PRODUCTS'
  | 'EXPORT_SALES'
  | 'EXPORT_DAILY_REPORT';

export type EntityType = 'PRODUCT' | 'SALE' | 'USER' | 'TENANT' | 'SETTINGS' | 'SUBSCRIPTION' | 'REFERRAL' | 'CATEGORY' | 'NOTIFICATION' | 'EXPORT';

export type ExportFormat = 'xlsx' | 'pdf';

// --- Modèles ---

export interface Tenant {
  id: string;
  name: string;
  owner_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  currency: string;
  logo_url: string | null;
  slogan: string | null;
  tax_number: string | null;
  timezone: string;
  referral_code: string;
  is_active: boolean;
  onboarding_completed: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  tenant_id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  display_name: string | null;
  is_active: boolean;
  last_login_at: Date | null;
  last_login_ip: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Subscription {
  id: string;
  tenant_id: string;
  tier: SubscriptionTier;
  billing_type: SubscriptionBillingType | null;
  status: SubscriptionStatus;
  start_date: Date;
  end_date: Date | null;
  activated_by: string | null;
  activation_method: ActivationMethod;
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  icon: string | null;
  is_default: boolean;
  sort_order: number;
  created_at: Date;
}

export interface Product {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  purchase_price: number;
  sell_price: number;
  stock_quantity: number;
  stock_threshold: number | null;
  image_url: string | null;
  description: string | null;
  has_expiry: boolean;
  expiry_date: Date | null;
  is_deleted: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Sale {
  id: string;
  tenant_id: string;
  seller_id: string;
  transaction_number: string;
  payment_method: PaymentMethod;
  momo_reference: string | null;
  subtotal: number;
  discount_amount: number;
  discount_type: DiscountType | null;
  discount_percentage: number | null;
  total_amount: number;
  profit_estimate: number | null;
  amount_received: number | null;
  change_given: number | null;
  is_cancelled: boolean;
  cancelled_at: Date | null;
  cancelled_by: string | null;
  created_at: Date;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_purchase_price: number;
  unit_sell_price: number;
  total_price: number;
  profit: number | null;
}

export interface AuditLog {
  id: string;
  tenant_id: string | null;
  user_id: string | null;
  username: string | null;
  user_role: string | null;
  action: AuditAction;
  entity_type: EntityType | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  read_at: Date | null;
  created_at: Date;
}

export interface Referral {
  id: string;
  referrer_tenant_id: string;
  referred_tenant_id: string;
  status: ReferralStatus;
  completed_at: Date | null;
  rewarded_at: Date | null;
  created_at: Date;
}

export interface Settings {
  id: string;
  tenant_id: string;
  global_stock_threshold: number;
  max_seller_discount_percentage: number;
  ticket_show_logo: boolean;
  ticket_show_slogan: boolean;
  ticket_footer_message: string;
  ticket_width: TicketWidth;
  ticket_show_qr: boolean;
  theme: Theme;
  created_at: Date;
  updated_at: Date;
}

export interface DailySaleCount {
  id: string;
  tenant_id: string;
  sale_date: Date;
  count: number;
}

export type StockMovementType = 'IN' | 'OUT' | 'ADJUSTMENT';

export interface StockMovement {
  id: string;
  tenant_id: string;
  product_id: string;
  movement_type: StockMovementType;
  quantity: number;
  old_stock: number;
  new_stock: number;
  reason: string | null;
  sale_id: string | null;
  user_id: string | null;
  created_at: Date;
}

// --- DTOs (Data Transfer Objects) ---

export interface RegisterInput {
  shop_name: string;
  owner_name: string;
  phone: string;
  password: string;
  password_confirm: string;
  referral_code?: string;
  sectors?: string[];
}

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface CreateVendorInput {
  password: string;
  password_confirm: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    role: UserRole;
    tenant_id: string;
    shop_name: string;
  };
}
