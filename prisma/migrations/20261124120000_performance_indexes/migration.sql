-- Add composite and single-column performance indexes on high-traffic core tables
-- Pure read-acceleration migration: zero table structure or data modifications.

-- Product indexes (active catalog filtering & expiry alert scans)
CREATE INDEX IF NOT EXISTS "Product_isActive_categoryId_idx" ON "Product"("isActive", "categoryId");
CREATE INDEX IF NOT EXISTS "Product_isActive_expiryDate_idx" ON "Product"("isActive", "expiryDate");

-- Sale indexes (dashboard, P&L reports, cashier analytics, sales history, AR aging)
CREATE INDEX IF NOT EXISTS "Sale_status_createdAt_idx" ON "Sale"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_userId_createdAt_idx" ON "Sale"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "Sale_customerId_dueAmount_idx" ON "Sale"("customerId", "dueAmount");
CREATE INDEX IF NOT EXISTS "Sale_createdAt_idx" ON "Sale"("createdAt");

-- SaleItem indexes (invoice joins, top products, inventory velocity analytics)
CREATE INDEX IF NOT EXISTS "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX IF NOT EXISTS "SaleItem_productId_idx" ON "SaleItem"("productId");

-- StockMovement indexes (inventory ledger & per-product history)
CREATE INDEX IF NOT EXISTS "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_type_createdAt_idx" ON "StockMovement"("type", "createdAt");

-- Expense indexes (P&L report date windows & category breakdowns)
CREATE INDEX IF NOT EXISTS "Expense_date_idx" ON "Expense"("date");
CREATE INDEX IF NOT EXISTS "Expense_category_date_idx" ON "Expense"("category", "date");
