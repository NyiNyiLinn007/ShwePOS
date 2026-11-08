-- Real-world POS upgrade: fractional quantities, expiry/batch, split payments, credit balance, partial refunds, loyalty settings
ALTER TABLE "Product"
  ALTER COLUMN "stockQuantity" TYPE DECIMAL(18, 3) USING ROUND("stockQuantity"::numeric, 3),
  ALTER COLUMN "lowStockThreshold" TYPE DECIMAL(18, 3) USING ROUND("lowStockThreshold"::numeric, 3),
  ADD COLUMN IF NOT EXISTS "batchNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "expiryDate" TIMESTAMP(3);

ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "creditBalance" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(18, 2);

ALTER TABLE "Sale"
  ADD COLUMN IF NOT EXISTS "dueAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pointsEarned" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "pointsRedeemed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "SaleItem"
  ALTER COLUMN "quantity" TYPE DECIMAL(18, 3) USING ROUND("quantity"::numeric, 3),
  ADD COLUMN IF NOT EXISTS "refundedQuantity" DECIMAL(18, 3) NOT NULL DEFAULT 0;

ALTER TABLE "StockMovement"
  ALTER COLUMN "quantity" TYPE DECIMAL(18, 3) USING ROUND("quantity"::numeric, 3),
  ALTER COLUMN "previousStock" TYPE DECIMAL(18, 3) USING ROUND("previousStock"::numeric, 3),
  ALTER COLUMN "newStock" TYPE DECIMAL(18, 3) USING ROUND("newStock"::numeric, 3);

ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "loyaltyEarnRate" DECIMAL(18, 2) NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS "loyaltyRedeemRate" DECIMAL(18, 2) NOT NULL DEFAULT 10;

CREATE TABLE IF NOT EXISTS "SalePayment" (
  "id" TEXT NOT NULL,
  "saleId" TEXT,
  "customerId" TEXT,
  "userId" TEXT NOT NULL,
  "shiftId" TEXT,
  "method" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "reference" TEXT,
  "type" TEXT NOT NULL DEFAULT 'CHECKOUT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SalePayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalePayment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SalePayment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SalePayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SalePayment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SalePayment_saleId_idx" ON "SalePayment"("saleId");
CREATE INDEX IF NOT EXISTS "SalePayment_customerId_idx" ON "SalePayment"("customerId");
CREATE INDEX IF NOT EXISTS "SalePayment_userId_idx" ON "SalePayment"("userId");
CREATE INDEX IF NOT EXISTS "SalePayment_shiftId_idx" ON "SalePayment"("shiftId");
