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
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  category?: Category;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  totalPurchases: number;
  loyaltyPoints: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  sales?: Sale[];
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
  changeAmount: number;
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'CREDIT';
  status: 'COMPLETED' | 'REFUNDED' | 'VOIDED';
  notes: string | null;
  createdAt: string | Date;
  customer?: Customer | null;
  user?: SafeUser;
  items?: SaleItem[];
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
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
}

// ── Cart Types (POS) ──────────────────────────────────────────────────────

/** A single item in the POS cart, including product info and selected quantity. */
export interface CartItem {
  productId: string;
  name: string;
  nameMm: string | null;
  sku: string;
  unitPrice: number;
  costPrice?: number;
  quantity: number;
  maxStock: number;
  unit: string;
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
