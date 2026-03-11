# 生产上线时切换 MySQL 说明

本地开发使用 SQLite，产品上线时按以下步骤切换为 MySQL：

## 1. 修改 Prisma 配置

编辑 `prisma/schema.prisma`：

```prisma
datasource db {
  provider = "mysql"   // 改为 mysql
  url      = env("DATABASE_URL")
}
```

## 2. 修改环境变量

编辑 `.env`：

```
DATABASE_URL="mysql://root:root@localhost:3306/pms"
```

（根据实际 MySQL 地址、用户名、密码、数据库名调整）

## 3. 启动 MySQL

```bash
cd "d:\康华数据\物业管理系统\PMS"
docker-compose up -d
```

或使用本机 MySQL，并创建数据库 `pms`。

## 4. 同步数据库并导入数据

```bash
cd pms-web
npx prisma db push
node prisma/seed.mjs
```

## 5. 构建并启动

```bash
npm run build
npm run start
```
