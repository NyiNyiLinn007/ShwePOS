/**
 * Zod validation schemas for all API routes.
 */
import { z } from 'zod';
import { EXPENSE_CATEGORY_VALUES } from '@/lib/constants';

const moneySchema = z.number().finite().min(0).max(1_000_000_000_000);
const quantitySchema = z.number().finite().min(0).max(1_000_000_000);
const positiveQuantitySchema = z.number().finite().positive('Quantity must be greater than zero').max(1_000_000_000);
const dateStringSchema = z.string().max(40).refine(
  (value) => !Number.isNaN(Date.parse(value)),
  'Date must be a valid ISO/date string'
);

const SAFE_RASTER_DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i;

export function isSafeImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (SAFE_RASTER_DATA_URL_REGEX.test(trimmed)) return true;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

const safeImageUrlSchema = z
  .string()
  .max(500000)
  .refine(isSafeImageUrl, 'Image must be an http(s) URL, relative path, or PNG/JPEG/WebP/GIF image');

// ---- Shared Enums ----

export const PaymentMethodEnum = z.enum(['CASH', 'CARD', 'MOBILE_BANKING', 'CREDIT', 'SPLIT']);
export const SinglePaymentMethodEnum = z.enum(['CASH', 'CARD', 'MOBILE_BANKING', 'CREDIT']);
export const SaleStatusEnum = z.enum(['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED']);
export const MovementTypeEnum = z.enum(['IN', 'OUT', 'ADJUSTMENT', 'RETURN']);
export const UserRoleEnum = z.enum(['ADMIN', 'MANAGER', 'CASHIER']);
export const ProductUnitEnum = z.enum(['pcs', 'kg', 'g', 'liter', 'ml', 'pack', 'box', 'bottle', 'dozen', 'set']);

// ---- Category Schemas ----

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(100),
  nameMm: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  slug: z.string().trim().min(1, 'Slug is required').max(100),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ---- Product Schemas ----

export const productUnitInputSchema = z.object({
  id: z.string().optional(),
  unitName: z.string().trim().min(1, 'Unit name is required').max(30),
  nameMm: z.string().trim().max(50).optional().nullable(),
  conversionFactor: positiveQuantitySchema,
  sellingPrice: moneySchema.positive('Unit selling price must be greater than zero'),
  barcode: z.string().trim().max(50).optional().nullable(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  nameMm: z.string().trim().max(200).optional().nullable(),
  sku: z.string().trim().min(1, 'SKU is required').max(50),
  barcode: z.string().trim().max(50).optional().nullable(),
  categoryId: z.string().trim().min(1, 'Category is required'),
  costPrice: moneySchema.default(0),
  sellingPrice: moneySchema.default(0),
  stockQuantity: quantitySchema.default(0),
  lowStockThreshold: quantitySchema.default(10),
  unit: ProductUnitEnum.default('pcs'),
  imageUrl: safeImageUrlSchema.optional().nullable(),
  batchNumber: z.string().trim().max(100).optional().nullable(),
  expiryDate: dateStringSchema.optional().nullable(),
  isActive: z.boolean().optional().default(true),
  productUnits: z.array(productUnitInputSchema).max(10).optional(),
});

export const updateProductSchema = createProductSchema.partial().omit({ stockQuantity: true });

export type ProductUnitInput = z.infer<typeof productUnitInputSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ---- Sale Schemas ----

export const saleItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: positiveQuantitySchema,
  discount: moneySchema.default(0),
  unitPrice: moneySchema.optional(),
  productUnitId: z.string().optional().nullable(),
});

export const salePaymentLegSchema = z.object({
  method: SinglePaymentMethodEnum,
  amount: moneySchema.positive('Payment leg amount must be positive'),
  reference: z.string().max(100).optional().nullable(),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, 'Sale must have at least one item'),
  customerId: z.string().optional().nullable(),
  paymentMethod: PaymentMethodEnum,
  paidAmount: moneySchema,
  payments: z.array(salePaymentLegSchema).max(10).optional(),
  pointsRedeemed: z.number().int().min(0).max(10_000_000).default(0),
  cartDiscount: moneySchema.default(0),
  promotionCode: z.string().max(50).optional().nullable(),
  quotationId: z.string().max(100).optional().nullable(),
  clientSaleId: z.string().uuid('Invalid idempotency key').optional(),
  paymentReference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const refundItemInputSchema = z.object({
  saleItemId: z.string().min(1),
  quantity: positiveQuantitySchema,
});

export const updateSaleStatusSchema = z.object({
  status: z.enum(['REFUNDED', 'VOIDED', 'PARTIALLY_REFUNDED']),
  reason: z.string().trim().min(1, 'Reason is required for refund/void').max(500),
  refundMethod: z.enum(['ORIGINAL', 'CASH']).optional().default('ORIGINAL'),
  items: z.array(refundItemInputSchema).optional(),
});

export type UpdateSaleStatusInput = z.infer<typeof updateSaleStatusSchema>;

// ---- Inventory / Stock Movement Schemas ----

export const inventoryMovementSchema = z.object({
  productId: z.string().trim().min(1, 'Product ID is required'),
  quantity: quantitySchema,
  type: MovementTypeEnum,
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;

// ---- Customer Schemas ----

export const createCustomerSchema = z.object({
  name: z.string().trim().min(1, 'Customer name is required').max(200),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email('Invalid email').max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  creditLimit: moneySchema.optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const repayCustomerDebtSchema = z.object({
  amount: moneySchema.positive('Repayment amount must be positive'),
  method: z.enum(['CASH', 'CARD', 'MOBILE_BANKING']),
  reference: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type RepayCustomerDebtInput = z.infer<typeof repayCustomerDebtSchema>;

// ---- Expense Schemas ----

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_VALUES),
  amount: moneySchema.positive('Amount must be positive'),
  description: z.string().trim().max(500).optional().nullable(),
  date: dateStringSchema.optional(),
  useCashDrawer: z.boolean().optional().default(false),
});

export const updateExpenseSchema = createExpenseSchema.omit({ useCashDrawer: true }).partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

// ---- Cashier Shift Schemas ----

export const openShiftSchema = z.object({
  openingCash: moneySchema,
  notes: z.string().trim().max(500).optional().nullable(),
});

export const closeShiftSchema = z.object({
  actualCash: moneySchema,
  notes: z.string().trim().max(500).optional().nullable(),
});

export const shiftCashMovementSchema = z.object({
  type: z.enum(['PAID_IN', 'PAID_OUT']),
  amount: moneySchema.positive('Amount must be greater than zero'),
  reason: z.string().trim().min(1, 'Reason is required').max(500),
});

export type OpenShiftInput = z.infer<typeof openShiftSchema>;
export type CloseShiftInput = z.infer<typeof closeShiftSchema>;
export type ShiftCashMovementInput = z.infer<typeof shiftCashMovementSchema>;

// ---- User Schemas ----

export const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100),
  email: z.string().trim().email('Invalid email').max(200),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: UserRoleEnum.default('CASHIER'),
  phone: z.string().trim().max(20).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(200).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .optional(),
  role: UserRoleEnum.optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const loginCredentialsSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(256),
}).strict();

// ---- Settings Schema ----

export const updateSettingsSchema = z.object({
  businessName: z.string().trim().min(1).max(200).optional(),
  businessNameMm: z.string().trim().max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable(),
  taxRate: z.number().min(0).max(100).optional(),
  currencySymbol: z.string().trim().max(10).optional(),
  logo: safeImageUrlSchema.optional().nullable(),
  receiptFooter: z.string().trim().max(500).optional().nullable(),
  loyaltyEnabled: z.boolean().optional(),
  loyaltyEarnRate: moneySchema.positive().optional(),
  loyaltyRedeemRate: moneySchema.positive().optional(),
  mobileBankingQrUrl: safeImageUrlSchema.optional().nullable(),
  mobileBankingName: z.string().trim().max(120).optional().nullable(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

// ---- Supplier & Purchase Order Schemas ----

export const SupplierPaymentMethodEnum = z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_BANKING', 'CREDIT']);
export const SupplierRepaymentMethodEnum = z.enum(['CASH', 'BANK_TRANSFER', 'MOBILE_BANKING']);

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, 'Supplier name is required').max(200),
  contactPerson: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email('Invalid email').max(200).optional().nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const repaySupplierDebtSchema = z.object({
  amount: moneySchema.positive('Repayment amount must be positive'),
  method: SupplierRepaymentMethodEnum,
  reference: z.string().max(100).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const purchaseItemInputSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: positiveQuantitySchema,
  unitCost: moneySchema,
  batchNumber: z.string().max(100).optional().nullable(),
  expiryDate: dateStringSchema.optional().nullable(),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  items: z.array(purchaseItemInputSchema).min(1, 'At least one item is required'),
  discountAmount: moneySchema.default(0),
  paidAmount: moneySchema.default(0),
  paymentMethod: SupplierPaymentMethodEnum.default('CASH'),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type RepaySupplierDebtInput = z.infer<typeof repaySupplierDebtSchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;

// ---- Stocktake Schemas ----

export const createStocktakeSchema = z.object({
  categoryId: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const updateStocktakeItemsSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        countedQty: quantitySchema.nullable(),
        notes: z.string().max(300).optional().nullable(),
      })
    )
    .min(1)
    .max(500),
  notes: z.string().max(500).optional().nullable(),
});

export const completeStocktakeSchema = z.object({
  applyUncountedAsZero: z.boolean().optional().default(false),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateStocktakeInput = z.infer<typeof createStocktakeSchema>;
export type UpdateStocktakeItemsInput = z.infer<typeof updateStocktakeItemsSchema>;
export type CompleteStocktakeInput = z.infer<typeof completeStocktakeSchema>;

// ---- Promotion Schemas ----

export const PromotionTypeEnum = z.enum([
  'PERCENT_OFF',
  'FIXED_OFF',
  'BUY_X_GET_Y',
  'MIN_SPEND_PERCENT',
  'MIN_SPEND_FIXED',
]);

export const createPromotionSchema = z.object({
  name: z.string().trim().min(1, 'Promotion name is required').max(150),
  nameMm: z.string().trim().max(150).optional().nullable(),
  code: z.string().trim().max(50).optional().nullable(),
  type: PromotionTypeEnum,
  discountValue: moneySchema.default(0),
  minSpend: moneySchema.optional().nullable(),
  buyQty: z.number().int().min(1).max(1000).optional().nullable(),
  getQty: z.number().int().min(1).max(1000).optional().nullable(),
  categoryId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  startDate: dateStringSchema,
  endDate: dateStringSchema,
  usageLimit: z.number().int().min(1).max(1_000_000).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updatePromotionSchema = createPromotionSchema.partial();

export type CreatePromotionInput = z.infer<typeof createPromotionSchema>;
export type UpdatePromotionInput = z.infer<typeof updatePromotionSchema>;

// ---- Quotation Schemas ----

export const QuotationStatusEnum = z.enum([
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'CONVERTED',
  'EXPIRED',
  'CANCELLED',
]);

export const quotationItemInputSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: positiveQuantitySchema,
  unitName: z.string().max(50).optional().nullable(),
  unitFactor: positiveQuantitySchema.default(1),
  unitPrice: moneySchema,
  discount: moneySchema.default(0),
});

export const createQuotationSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().max(200).optional().nullable(),
  customerPhone: z.string().max(30).optional().nullable(),
  items: z.array(quotationItemInputSchema).min(1, 'At least one item is required'),
  discountAmount: moneySchema.default(0),
  taxRate: z.number().min(0).max(100).optional(),
  validUntil: dateStringSchema,
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED']).optional().default('SENT'),
  notes: z.string().max(500).optional().nullable(),
});

export const updateQuotationSchema = z.object({
  validUntil: dateStringSchema.optional(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED', 'CANCELLED']).optional(),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
