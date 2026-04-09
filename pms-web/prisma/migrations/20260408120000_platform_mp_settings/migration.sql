-- CreateTable（单行 id=1，平台级小程序配置）
CREATE TABLE "PlatformMpSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
    "tenantAppId" TEXT,
    "tenantAppSecret" TEXT,
    "staffAppId" TEXT,
    "staffAppSecret" TEXT,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
