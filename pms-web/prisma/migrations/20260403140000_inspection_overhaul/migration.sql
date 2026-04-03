-- AlterTable
ALTER TABLE "NfcTag" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';

-- AlterTable
ALTER TABLE "InspectionPlan" ADD COLUMN "cycleWeekday" INTEGER;
ALTER TABLE "InspectionPlan" ADD COLUMN "cycleMonthDay" INTEGER;
ALTER TABLE "InspectionPlan" ADD COLUMN "buildingId" INTEGER;

-- AlterTable
ALTER TABLE "InspectionTask" ADD COLUMN "buildingId" INTEGER;
