-- ShwePOS Tier 1 & Tier 2 Operations Suite + Credit Balance Normalization
-- Idempotent PostgreSQL / Neon Serverless migration

-- 1. StocktakeSession & StocktakeItem
CREATE TABLE IF NOT EXISTS "StocktakeSession" (
  "id" TEXT NOT NULL,
  "sessionNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "categoryId" TEXT,
  "userId" TEXT NOT NULL,
  "completedById" TEXT,
  "notes" TEXT,
  "totalItems" INTEGER NOT NULL DEFAULT 0,
  "varianceItems" INTEGER NOT NULL DEFAULT 0,
  "totalVarianceValue" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StocktakeSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StocktakeSession_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StocktakeSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StocktakeSession_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "StocktakeSession_sessionNumber_key" ON "StocktakeSession"("sessionNumber");
CREATE INDEX IF NOT EXISTS "StocktakeSession_status_idx" ON "StocktakeSession"("status");
CREATE INDEX IF NOT EXISTS "StocktakeSession_createdAt_idx" ON "StocktakeSession"("createdAt");

CREATE TABLE IF NOT EXISTS "StocktakeItem" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "systemQty" DECIMAL(18, 3) NOT NULL,
  "countedQty" DECIMAL(18, 3),
  "varianceQty" DECIMAL(18, 3) NOT NULL DEFAULT 0,
  "unitCost" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "varianceValue" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "notes" TEXT,

  CONSTRAINT "StocktakeItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StocktakeItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StocktakeSession"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StocktakeItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "StocktakeItem_sessionId_productId_key" ON "StocktakeItem"("sessionId", "productId");
CREATE INDEX IF NOT EXISTS "StocktakeItem_sessionId_idx" ON "StocktakeItem"("sessionId");
CREATE INDEX IF NOT EXISTS "StocktakeItem_productId_idx" ON "StocktakeItem"("productId");

-- 2. Promotion & Sale Promotion Fields
CREATE TABLE IF NOT EXISTS "Promotion" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameMm" TEXT,
  "code" TEXT,
  "type" TEXT NOT NULL,
  "discountValue" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "minSpend" DECIMAL(18, 2),
  "buyQty" INTEGER,
  "getQty" INTEGER,
  "categoryId" TEXT,
  "productId" TEXT,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "usageLimit" INTEGER,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Promotion_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Promotion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Promotion_code_key" ON "Promotion"("code");
CREATE INDEX IF NOT EXISTS "Promotion_isActive_startDate_endDate_idx" ON "Promotion"("isActive", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "Promotion_code_idx" ON "Promotion"("code");

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "promotionId" TEXT,
  ADD COLUMN IF NOT EXISTS "promotionCode" TEXT,
  ADD COLUMN IF NOT EXISTS "promotionDiscount" DECIMAL(18, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Sale_promotionId_fkey'
  ) THEN
    ALTER TABLE "Sale"
      ADD CONSTRAINT "Sale_promotionId_fkey"
      FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Quotation & QuotationItem
CREATE TABLE IF NOT EXISTS "Quotation" (
  "id" TEXT NOT NULL,
  "quoteNumber" TEXT NOT NULL,
  "customerId" TEXT,
  "customerName" TEXT,
  "customerPhone" TEXT,
  "userId" TEXT NOT NULL,
  "subtotal" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "taxAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "validUntil" TIMESTAMP(3) NOT NULL,
  "convertedSaleId" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Quotation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Quotation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Quotation_convertedSaleId_fkey" FOREIGN KEY ("convertedSaleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "Quotation_quoteNumber_key" ON "Quotation"("quoteNumber");
CREATE INDEX IF NOT EXISTS "Quotation_status_idx" ON "Quotation"("status");
CREATE INDEX IF NOT EXISTS "Quotation_customerId_idx" ON "Quotation"("customerId");
CREATE INDEX IF NOT EXISTS "Quotation_createdAt_idx" ON "Quotation"("createdAt");

CREATE TABLE IF NOT EXISTS "QuotationItem" (
  "id" TEXT NOT NULL,
  "quotationId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(18, 3) NOT NULL,
  "unitName" TEXT,
  "unitFactor" DECIMAL(18, 3) NOT NULL DEFAULT 1,
  "unitPrice" DECIMAL(18, 2) NOT NULL,
  "discount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "total" DECIMAL(18, 2) NOT NULL,

  CONSTRAINT "QuotationItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuotationItem_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuotationItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "QuotationItem_quotationId_idx" ON "QuotationItem"("quotationId");
CREATE INDEX IF NOT EXISTS "QuotationItem_productId_idx" ON "QuotationItem"("productId");

-- 4. Phase 0 Safe Credit Normalization (treat 0 creditLimit as NULL/Unlimited & clamp negative balances)
UPDATE "Customer"
SET "creditLimit" = NULL
WHERE "creditLimit" = 0;

UPDATE "Customer"
SET "creditBalance" = 0
WHERE "creditBalance" < 0;
