-- Convert monetary values to fixed-point decimals to prevent binary floating-point drift.
ALTER TABLE "Product"
  ALTER COLUMN "costPrice" TYPE DECIMAL(18, 2) USING ROUND("costPrice"::numeric, 2),
  ALTER COLUMN "sellingPrice" TYPE DECIMAL(18, 2) USING ROUND("sellingPrice"::numeric, 2);

ALTER TABLE "Customer"
  ALTER COLUMN "totalPurchases" TYPE DECIMAL(18, 2) USING ROUND("totalPurchases"::numeric, 2);

ALTER TABLE "Sale"
  ALTER COLUMN "subtotal" TYPE DECIMAL(18, 2) USING ROUND("subtotal"::numeric, 2),
  ALTER COLUMN "discountAmount" TYPE DECIMAL(18, 2) USING ROUND("discountAmount"::numeric, 2),
  ALTER COLUMN "taxAmount" TYPE DECIMAL(18, 2) USING ROUND("taxAmount"::numeric, 2),
  ALTER COLUMN "totalAmount" TYPE DECIMAL(18, 2) USING ROUND("totalAmount"::numeric, 2),
  ALTER COLUMN "paidAmount" TYPE DECIMAL(18, 2) USING ROUND("paidAmount"::numeric, 2),
  ALTER COLUMN "changeAmount" TYPE DECIMAL(18, 2) USING ROUND("changeAmount"::numeric, 2);

ALTER TABLE "SaleItem"
  ALTER COLUMN "unitPrice" TYPE DECIMAL(18, 2) USING ROUND("unitPrice"::numeric, 2),
  ALTER COLUMN "costPrice" TYPE DECIMAL(18, 2) USING ROUND("costPrice"::numeric, 2),
  ALTER COLUMN "discount" TYPE DECIMAL(18, 2) USING ROUND("discount"::numeric, 2),
  ALTER COLUMN "total" TYPE DECIMAL(18, 2) USING ROUND("total"::numeric, 2);

ALTER TABLE "Expense"
  ALTER COLUMN "amount" TYPE DECIMAL(18, 2) USING ROUND("amount"::numeric, 2);
