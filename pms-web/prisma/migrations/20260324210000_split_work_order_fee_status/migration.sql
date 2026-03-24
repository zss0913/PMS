-- 将旧版单一「待确认费用」迁移为「待租客确认费用」（当时已在等租客）
UPDATE "WorkOrder" SET "status" = '待租客确认费用' WHERE "status" = '待确认费用';
