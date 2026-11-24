// ── Frontend type definitions matching the Prisma schema ──────────────────
// These are plain interfaces for use in React components and API responses.
// They mirror the database models but avoid importing Prisma types directly.

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  phone: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

/** User without the password field, for client-side use. */
export type SafeUser = Omit<User, 'password'>;

export interface Category {
  id: string;
  name: string;
  nameMm: string | null;
  description: string | null;
  slug: string;
  isActive: boolean;
  createdAt: string | Date;
  products?: Product[];
}

export interface ProductUnit {
  id: string;
  productId: string;
  unitName: string;
  nameMm: string | null;
  conversionFactor: number;
  sellingPrice: number;
  barcode: string | null;
}

export interface Product {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  barcode: string | null;
  categoryId: string;
  costPrice?: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  imageUrl: string | null;
  batchNumber?: string | null;
  expiryDate?: string | Date | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  category?: Category;
  productUnits?: ProductUnit[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  totalPurchases: number;
  creditBalance?: number;
  creditLimit?: number | null;
  loyaltyPoints: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  sales?: Sale[];
}

export interface SalePayment {
  id: string;
  saleId: string | null;
  customerId: string | null;
  userId: string;
  shiftId: string | null;
  method: 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'CREDIT';
  amount: number;
  reference: string | null;
  type: 'CHECKOUT' | 'DEBT_REPAYMENT';
  notes: string | null;
  createdAt: string | Date;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  userId: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount?: number;
  changeAmount: number;
  pointsEarned?: number;
  pointsRedeemed?: number;
  promotionId?: string | null;
  promotionCode?: string | null;
  promotionDiscount?: number;
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'CREDIT' | 'SPLIT';
  status: 'COMPLETED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'VOIDED';
  notes: string | null;
  createdAt: string | Date;
  customer?: Customer | null;
  user?: SafeUser;
  items?: SaleItem[];
  payments?: SalePayment[];
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  refundedQuantity?: number;
  unitName?: string | null;
  unitFactor?: number;
  unitPrice: number;
  discount: number;
  total: number;
  product?: Product;
}

export interface StockMovement {
  id: string;
  productId: string;
  userId: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
  reason: string | null;
  previousStock: number;
  newStock: number;
  createdAt: string | Date;
  product?: Product;
  user?: SafeUser;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  userId: string;
  date: string | Date;
  createdAt: string | Date;
  user?: SafeUser;
}

export interface Settings {
  id: string;
  businessName: string;
  businessNameMm: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxRate: number;
  currencySymbol: string;
  logo: string | null;
  receiptFooter: string | null;
  loyaltyEnabled?: boolean;
  loyaltyEarnRate?: number;
  loyaltyRedeemRate?: number;
  mobileBankingQrUrl?: string | null;
  mobileBankingName?: string | null;
}

// ── Procurement & Audit Types ─────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditBalance: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  purchaseOrderCount?: number;
  totalPurchased?: number;
}

export interface PurchaseItem {
  id: string;
  purchaseOrderId: string;
  productId: string;
  quantity: number;
  unitCost: number;
  total: number;
  batchNumber: string | null;
  expiryDate: string | Date | null;
  product?: {
    id: string;
    name: string;
    nameMm: string | null;
    sku: string;
    unit: string;
  };
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierId: string;
  userId: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: 'CASH' | 'BANK_TRANSFER' | 'MOBILE_BANKING' | 'CREDIT';
  status: 'RECEIVED' | 'CANCELLED';
  notes: string | null;
  createdAt: string | Date;
  supplier?: {
    id: string;
    name: string;
    phone: string | null;
  };
  user?: {
    id: string;
    name: string;
  };
  items?: PurchaseItem[];
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  userId: string;
  amount: number;
  method: 'CASH' | 'BANK_TRANSFER' | 'MOBILE_BANKING';
  reference: string | null;
  notes: string | null;
  createdAt: string | Date;
  user?: {
    id: string;
    name: string;
  };
}

export interface AuditLogRecord {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown> | null;
  createdAt: string | Date;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

// ── Stocktake, Promotions & Quotations Types ──────────────────────────────

export interface StocktakeItemDTO {
  id: string;
  sessionId: string;
  productId: string;
  systemQty: number;
  countedQty: number | null;
  varianceQty: number;
  unitCost: number;
  varianceValue: number;
  notes: string | null;
  product?: {
    id: string;
    name: string;
    nameMm: string | null;
    sku: string;
    barcode: string | null;
    unit: string;
    category?: { id: string; name: string; nameMm: string | null };
    productUnits?: Array<{
      id: string;
      unitName: string;
      conversionFactor: number;
      barcode: string | null;
    }>;
  };
}

export interface StocktakeSessionDTO {
  id: string;
  sessionNumber: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  categoryId: string | null;
  userId: string;
  completedById: string | null;
  notes: string | null;
  totalItems: number;
  varianceItems: number;
  totalVarianceValue: number;
  createdAt: string | Date;
  completedAt: string | Date | null;
  category?: { id: string; name: string; nameMm: string | null } | null;
  user?: { id: string; name: string };
  completedBy?: { id: string; name: string } | null;
  items?: StocktakeItemDTO[];
}

export type PromotionType =
  | 'PERCENT_OFF'
  | 'FIXED_OFF'
  | 'BUY_X_GET_Y'
  | 'MIN_SPEND_PERCENT'
  | 'MIN_SPEND_FIXED';

export interface PromotionDTO {
  id: string;
  name: string;
  nameMm: string | null;
  code: string | null;
  type: PromotionType;
  discountValue: number;
  minSpend: number | null;
  buyQty: number | null;
  getQty: number | null;
  categoryId: string | null;
  productId: string | null;
  startDate: string | Date;
  endDate: string | Date;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  category?: { id: string; name: string; nameMm: string | null } | null;
  product?: { id: string; name: string; nameMm: string | null; sku: string } | null;
}

export interface QuotationItemDTO {
  id: string;
  quotationId: string;
  productId: string;
  quantity: number;
  unitName: string | null;
  unitFactor: number;
  unitPrice: number;
  discount: number;
  total: number;
  product?: {
    id: string;
    name: string;
    nameMm: string | null;
    sku: string;
    unit: string;
    sellingPrice?: number;
    stockQuantity?: number;
  };
}

export type QuotationStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACCEPTED'
  | 'CONVERTED'
  | 'EXPIRED'
  | 'CANCELLED';

export interface QuotationDTO {
  id: string;
  quoteNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  userId: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  status: QuotationStatus;
  validUntil: string | Date;
  convertedSaleId: string | null;
  notes: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  customer?: { id: string; name: string; phone: string | null } | null;
  user?: { id: string; name: string };
  items?: QuotationItemDTO[];
}

// ── Cart Types (POS) ──────────────────────────────────────────────────────

/** A single item in the POS cart, including product info, unit packaging, and price override. */
export interface CartItem {
  lineKey?: string;
  productId: string;
  categoryId?: string;
  name: string;
  nameMm: string | null;
  sku: string;
  unitPrice: number;
  originalUnitPrice?: number;
  baseSellingPrice?: number;
  costPrice?: number;
  quantity: number;
  discount?: number;
  maxStock: number;
  unit: string;
  baseUnit?: string;
  productUnitId?: string | null;
  unitFactor?: number;
  availableUnits?: ProductUnit[];
  imageUrl: string | null;
}

// ── API Response Types ────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Dashboard Types ───────────────────────────────────────────────────────

export interface DashboardStats {
  todaySales: number;
  todayRevenue: number;
  totalProducts: number;
  totalCustomers: number;
  lowStockCount: number;
}

export interface SalesChartData {
  label: string;
  revenue: number;
  count: number;
}

// ── Form Input Types ──────────────────────────────────────────────────────

export interface ProductFormData {
  name: string;
  nameMm: string;
  sku: string;
  barcode: string;
  categoryId: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  imageUrl: string;
  isActive: boolean;
}

export interface CategoryFormData {
  name: string;
  nameMm: string;
  description: string;
  slug: string;
  isActive: boolean;
}

export interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface ExpenseFormData {
  category: string;
  amount: number;
  description: string;
  date: string;
}

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  phone: string;
  isActive: boolean;
}

export interface StockMovementFormData {
  productId: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
  reason: string;
}

// ── Checkout Types ────────────────────────────────────────────────────────

export interface CheckoutPayload {
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
    discount: number;
  }[];
  customerId: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'CREDIT';
  notes: string;
}
