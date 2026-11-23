-- Enterprise Tiers 1-3 Upgrade:
-- Tier 1: Settings.mobileBankingQrUrl & mobileBankingName
-- Tier 2: ProductUnit (multi-unit packaging), SaleItem.unitName & unitFactor, Supplier, PurchaseOrder, PurchaseItem, SupplierPayment
-- Tier 3: AuditLog

ALTER TABLE "Settings"
  ADD COLUMN IF NOT EXISTS "mobileBankingQrUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "mobileBankingName" TEXT DEFAULT 'KBZPay / WavePay';

ALTER TABLE "SaleItem"
  ADD COLUMN IF NOT EXISTS "unitName" TEXT,
  ADD COLUMN IF NOT EXISTS "unitFactor" DECIMAL(18, 3) NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "ProductUnit" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "unitName" TEXT NOT NULL,
  "nameMm" TEXT,
  "conversionFactor" DECIMAL(18, 3) NOT NULL,
  "sellingPrice" DECIMAL(18, 2) NOT NULL,
  "barcode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProductUnit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProductUnit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductUnit_barcode_key" ON "ProductUnit"("barcode");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductUnit_productId_unitName_key" ON "ProductUnit"("productId", "unitName");
CREATE INDEX IF NOT EXISTS "ProductUnit_productId_idx" ON "ProductUnit"("productId");

CREATE TABLE IF NOT EXISTS "Supplier" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "contactPerson" TEXT,
  "phone" TEXT,
  "email" TEXT,
  "address" TEXT,
  "creditBalance" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "id" TEXT NOT NULL,
  "poNumber" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subtotal" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "discountAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "totalAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "paidAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "dueAmount" DECIMAL(18, 2) NOT NULL DEFAULT 0,
  "paymentMethod" TEXT NOT NULL DEFAULT 'CASH',
  "status" TEXT NOT NULL DEFAULT 'RECEIVED',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_userId_idx" ON "PurchaseOrder"("userId");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_createdAt_idx" ON "PurchaseOrder"("createdAt");

CREATE TABLE IF NOT EXISTS "PurchaseItem" (
  "id" TEXT NOT NULL,
  "purchaseOrderId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(18, 3) NOT NULL,
  "unitCost" DECIMAL(18, 2) NOT NULL,
  "total" DECIMAL(18, 2) NOT NULL,
  "batchNumber" TEXT,
  "expiryDate" TIMESTAMP(3),

  CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PurchaseItem_purchaseOrderId_idx" ON "PurchaseItem"("purchaseOrderId");
CREATE INDEX IF NOT EXISTS "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

CREATE TABLE IF NOT EXISTS "SupplierPayment" (
  "id" TEXT NOT NULL,
  "supplierId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" DECIMAL(18, 2) NOT NULL,
  "method" TEXT NOT NULL DEFAULT 'CASH',
  "reference" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierPayment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupplierPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "SupplierPayment_supplierId_idx" ON "SupplierPayment"("supplierId");
CREATE INDEX IF NOT EXISTS "SupplierPayment_userId_idx" ON "SupplierPayment"("userId");

CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_idx" ON "AuditLog"("entityType");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
