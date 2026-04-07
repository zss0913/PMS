-- SQLite：周期时刻 JSON、须拍照（若列已存在会报错，可改用 npx prisma db push）
ALTER TABLE "InspectionPlan" ADD COLUMN "cycleSchedule" TEXT;
ALTER TABLE "InspectionPlan" ADD COLUMN "requirePhoto" BOOLEAN NOT NULL DEFAULT 1;
ALTER TABLE "InspectionTask" ADD COLUMN "requirePhoto" BOOLEAN NOT NULL DEFAULT 1;
