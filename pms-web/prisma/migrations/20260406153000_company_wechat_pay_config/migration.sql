-- 公司级微信支付配置
ALTER TABLE "Company" ADD COLUMN "wechatMchId" TEXT;
ALTER TABLE "Company" ADD COLUMN "wechatMchSerialNo" TEXT;
ALTER TABLE "Company" ADD COLUMN "wechatApiV3Key" TEXT;
ALTER TABLE "Company" ADD COLUMN "wechatPrivateKeyPem" TEXT;
