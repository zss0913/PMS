-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN "deviceMaintenanceRecordId" INTEGER;

-- CreateIndex
CREATE INDEX "WorkOrder_companyId_deviceMaintenanceRecordId_idx" ON "WorkOrder"("companyId", "deviceMaintenanceRecordId");
