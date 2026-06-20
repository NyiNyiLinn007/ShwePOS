/**
 * Zod validation schemas for all API routes.
 */
import { z } from 'zod';

// ---- Shared Enums ----

export const PaymentMethodEnum = z.enum(['CASH', 'CARD', 'MOBILE_BANKING', 'CREDIT']);
export const SaleStatusEnum = z.enum(['COMPLETED', 'REFUNDED', 'VOIDED']);
export const MovementTypeEnum = z.enum(['IN', 'OUT', 'ADJUSTMENT', 'RETURN']);
export const UserRoleEnum = z.enum(['ADMIN', 'MANAGER', 'CASHIER']);
export const ProductUnitEnum = z.enum(['pcs', 'kg', 'g', 'liter', 'ml', 'pack', 'box', 'bottle', 'dozen', 'set']);

// ---- Category Schemas ----

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  nameMm: z.string().max(100).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  slug: z.string().min(1, 'Slug is required').max(100),
  isActive: z.boolean().optional().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ---- Product Schemas ----

export const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').max(200),
  nameMm: z.string().max(200).optional().nullable(),
  sku: z.string().min(1, 'SKU is required').max(50),
  barcode: z.string().max(50).optional().nullable(),
  categoryId: z.string().min(1, 'Category is required'),
  costPrice: z.number().min(0, 'Cost price must be 0 or more').default(0),
  sellingPrice: z.number().min(0, 'Selling price must be 0 or more').default(0),
  stockQuantity: z.number().int().min(0).default(0),
  lowStockThreshold: z.number().int().min(0).default(10),
  unit: ProductUnitEnum.default('pcs'),
  imageUrl: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial().omit({ stockQuantity: true });

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// ---- Sale Schemas ----

export const saleItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  discount: z.number().min(0, 'Discount cannot be negative').default(0),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemInputSchema).min(1, 'Sale must have at least one item'),
  customerId: z.string().optional().nullable(),
  paymentMethod: PaymentMethodEnum,
  paidAmount: z.number().min(0, 'Paid amount cannot be negative'),
  cartDiscount: z.number().min(0, 'Cart discount cannot be negative').default(0),
  clientSaleId: z.string().uuid('Invalid idempotency key').optional(),
  notes: z.string().max(500).optional().nullable(),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;

export const updateSaleStatusSchema = z.object({
  status: z.enum(['REFUNDED', 'VOIDED']),
  reason: z.string().min(1, 'Reason is required for refund/void').max(500),
});

export type UpdateSaleStatusInput = z.infer<typeof updateSaleStatusSchema>;

// ---- Inventory / Stock Movement Schemas ----

export const inventoryMovementSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().int().positive('Quantity must be a positive integer'),
  type: MovementTypeEnum,
  reason: z.string().min(1, 'Reason is required').max(500),
});

export type InventoryMovementInput = z.infer<typeof inventoryMovementSchema>;

// ---- Customer Schemas ----

export const createCustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(200),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email('Invalid email').max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;

// ---- Expense Schemas ----

const EXPENSE_CATEGORIES = [
  'RENT', 'UTILITIES', 'SALARY', 'SUPPLIES', 'MAINTENANCE',
  'TRANSPORT', 'MARKETING', 'FOOD', 'INSURANCE', 'TAX', 'OTHER',
] as const;

export const createExpenseSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().max(500).optional().nullable(),
  date: z.string().optional(), // ISO date string
});

export const updateExpenseSchema = createExpenseSchema.partial();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

// ---- User Schemas ----

export const createUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email').max(200),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  role: UserRoleEnum.default('CASHIER'),
  phone: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(200).optional(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .optional(),
  role: UserRoleEnum.optional(),
  phone: z.string().max(20).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ---- Settings Schema ----

export const updateSettingsSchema = z.object({
  businessName: z.string().min(1).max(200).optional(),
  businessNameMm: z.string().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  taxRate: z.number().min(0).max(100).optional(),
  currencySymbol: z.string().max(10).optional(),
  logo: z.string().max(1000).optional().nullable(),
  receiptFooter: z.string().max(500).optional().nullable(),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
