-- CreateTable
CREATE TABLE "ReceiptIssueRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "tenantName" TEXT NOT NULL,
    "mergeMode" TEXT NOT NULL,
    "billCount" INTEGER NOT NULL,
    "totalAmount" REAL NOT NULL,
    "billIdsJson" TEXT NOT NULL,
    "billCodesJson" TEXT NOT NULL,
    "lineAmountsJson" TEXT NOT NULL,
    "templateId" INTEGER,
    "operatorId" INTEGER,
    "operatorName" TEXT,
    "operatorPhone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReceiptIssueRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ReceiptIssueRecord_companyId_createdAt_idx" ON "ReceiptIssueRecord"("companyId", "createdAt");
CREATE INDEX "ReceiptIssueRecord_companyId_batchId_idx" ON "ReceiptIssueRecord"("companyId", "batchId");
