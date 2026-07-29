-- CreateTable
CREATE TABLE "DataMigrationAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "summary" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DataMigrationAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataMigrationAudit_userId_createdAt_idx" ON "DataMigrationAudit"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "DataMigrationAudit" ADD CONSTRAINT "DataMigrationAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
