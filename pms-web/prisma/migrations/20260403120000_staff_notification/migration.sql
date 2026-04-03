-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "companyId" INTEGER NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "buildingId" INTEGER,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffNotification_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StaffNotification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "StaffNotification_companyId_employeeId_createdAt_idx" ON "StaffNotification"("companyId", "employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffNotification_companyId_category_entityType_entityId_employeeId_key" ON "StaffNotification"("companyId", "category", "entityType", "entityId", "employeeId");
