-- Add payment reconciliation metadata to sales.
ALTER TABLE "Sale"
  ADD COLUMN "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
  ADD COLUMN "paymentReference" TEXT,
  ADD COLUMN "paymentProviderResponse" TEXT;

-- Immutable refund/void adjustment records.
CREATE TABLE "SaleAdjustment" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "approverUserId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "paymentMethod" TEXT NOT NULL,
  "paymentReversalStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SaleAdjustment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SaleAdjustment_saleId_idx" ON "SaleAdjustment"("saleId");
CREATE INDEX "SaleAdjustment_approverUserId_idx" ON "SaleAdjustment"("approverUserId");

ALTER TABLE "SaleAdjustment"
  ADD CONSTRAINT "SaleAdjustment_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SaleAdjustment"
  ADD CONSTRAINT "SaleAdjustment_approverUserId_fkey"
  FOREIGN KEY ("approverUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Shift and cash drawer movement audit records.
CREATE TABLE "Shift" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "openingCash" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "closingCash" DECIMAL(18, 2),
  "expectedCash" DECIMAL(18, 2),
  "actualCash" DECIMAL(18, 2),
  "variance" DECIMAL(18, 2),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "notes" TEXT,

  CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Shift_userId_status_idx" ON "Shift"("userId", "status");

ALTER TABLE "Shift"
  ADD CONSTRAINT "Shift_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CashDrawerMovement" (
  "id" TEXT NOT NULL,
  "shiftId" TEXT,
  "saleId" TEXT,
  "expenseId" TEXT,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CashDrawerMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CashDrawerMovement_shiftId_idx" ON "CashDrawerMovement"("shiftId");
CREATE INDEX "CashDrawerMovement_saleId_idx" ON "CashDrawerMovement"("saleId");
CREATE INDEX "CashDrawerMovement_expenseId_idx" ON "CashDrawerMovement"("expenseId");
CREATE INDEX "CashDrawerMovement_userId_idx" ON "CashDrawerMovement"("userId");
CREATE INDEX "CashDrawerMovement_type_idx" ON "CashDrawerMovement"("type");

ALTER TABLE "CashDrawerMovement"
  ADD CONSTRAINT "CashDrawerMovement_shiftId_fkey"
  FOREIGN KEY ("shiftId") REFERENCES "Shift"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashDrawerMovement"
  ADD CONSTRAINT "CashDrawerMovement_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashDrawerMovement"
  ADD CONSTRAINT "CashDrawerMovement_expenseId_fkey"
  FOREIGN KEY ("expenseId") REFERENCES "Expense"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CashDrawerMovement"
  ADD CONSTRAINT "CashDrawerMovement_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
