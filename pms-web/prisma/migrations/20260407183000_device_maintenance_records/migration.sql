-- 设备维保：一记录多设备 + 快照；替换原 DeviceMaintenance（单设备 + 级联删）
CREATE TABLE "DeviceMaintenanceRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "maintainerId" INTEGER,
    "maintainerName" TEXT NOT NULL,
    "cost" REAL NOT NULL DEFAULT 0,
    "content" TEXT NOT NULL,
    "images" TEXT,
    "remark" TEXT,
    "companyId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceMaintenanceRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeviceMaintenanceRecord_maintainerId_fkey" FOREIGN KEY ("maintainerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "DeviceMaintenanceRecord_companyId_code_key" ON "DeviceMaintenanceRecord"("companyId", "code");
CREATE INDEX "DeviceMaintenanceRecord_companyId_date_idx" ON "DeviceMaintenanceRecord"("companyId", "date");

CREATE TABLE "DeviceMaintenanceItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recordId" INTEGER NOT NULL,
    "deviceId" INTEGER,
    "deviceCode" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceType" TEXT,
    "buildingName" TEXT,
    CONSTRAINT "DeviceMaintenanceItem_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "DeviceMaintenanceRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DeviceMaintenanceItem_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "DeviceMaintenanceItem_recordId_idx" ON "DeviceMaintenanceItem"("recordId");
CREATE INDEX "DeviceMaintenanceItem_deviceId_idx" ON "DeviceMaintenanceItem"("deviceId");

-- 从旧表迁移（若库由 db push 生成且存在 DeviceMaintenance）
INSERT INTO "DeviceMaintenanceRecord" ("id", "code", "type", "date", "maintainerId", "maintainerName", "cost", "content", "images", "remark", "companyId", "createdAt", "updatedAt")
SELECT
  dm."id",
  dm."code",
  dm."type",
  dm."date",
  dm."maintainerId",
  COALESCE(e."name", '（未知）'),
  dm."cost",
  dm."content",
  dm."images",
  dm."remark",
  dm."companyId",
  dm."createdAt",
  dm."createdAt"
FROM "DeviceMaintenance" dm
LEFT JOIN "Employee" e ON e."id" = dm."maintainerId";

INSERT INTO "DeviceMaintenanceItem" ("recordId", "deviceId", "deviceCode", "deviceName", "deviceType", "buildingName")
SELECT
  dm."id",
  dm."deviceId",
  d."code",
  d."name",
  d."type",
  b."name"
FROM "DeviceMaintenance" dm
INNER JOIN "Device" d ON d."id" = dm."deviceId"
INNER JOIN "Building" b ON b."id" = d."buildingId";

DELETE FROM sqlite_sequence WHERE name = 'DeviceMaintenanceRecord';
INSERT INTO sqlite_sequence (name, seq) SELECT 'DeviceMaintenanceRecord', IFNULL(MAX("id"), 0) FROM "DeviceMaintenanceRecord";

DELETE FROM sqlite_sequence WHERE name = 'DeviceMaintenanceItem';
INSERT INTO sqlite_sequence (name, seq) SELECT 'DeviceMaintenanceItem', IFNULL(MAX("id"), 0) FROM "DeviceMaintenanceItem";

DROP TABLE "DeviceMaintenance";
