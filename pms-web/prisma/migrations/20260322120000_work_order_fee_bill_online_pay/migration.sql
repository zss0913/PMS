-- SQLite: 工单费用账单 + 在线支付关联
ALTER TABLE "Bill" ADD COLUMN "workOrderId" INTEGER;
CREATE INDEX "Bill_companyId_workOrderId_idx" ON "Bill"("companyId", "workOrderId");

ALTER TABLE "Payment" ADD COLUMN "relatedBillId" INTEGER;
CREATE INDEX "Payment_companyId_relatedBillId_idx" ON "Payment"("companyId", "relatedBillId");

-- 将 Payment.operatorId 改为可空（若库中已存在该列，部分 SQLite 版本需重建表；开发环境可 prisma db push）
-- 已由 prisma db push 处理 schema 同步
