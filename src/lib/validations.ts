/**
 * Zod validation schemas for Products and Categories.
 */
import { z } from 'zod';

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
  unit: z.enum(['pcs', 'kg', 'liter', 'pack', 'box', 'dozen', 'set']).default('pcs'),
  imageUrl: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
