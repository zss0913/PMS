# 商业写字楼物业管理系统 (PMS)

基于 Next.js 16 + Prisma + SQLite/MySQL 的物业管理系统 PC 端。

## 技术栈

- **前端**: Next.js 16, React 19, Tailwind CSS 4
- **后端**: Next.js API Routes
- **数据库**: SQLite (本地开发) / MySQL (生产上线)
- **ORM**: Prisma
- **认证**: JWT (jose) + HttpOnly Cookie

## 快速启动

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，本地开发默认使用 SQLite（无需 Docker）：

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key"
```

### 3. 初始化数据库

```bash
npm run db:push
npm run db:seed
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5001

### 测试账号

| 角色 | 手机号 | 密码 |
|------|--------|------|
| 超级管理员 | 13800138000 | 123456 |
| 物业管理员 | 13800138002 | 123456 |

## 生产上线（切换 MySQL）

1. 修改 `prisma/schema.prisma` 中 `provider` 为 `mysql`
2. 修改 `.env` 中 `DATABASE_URL` 为 `mysql://root:root@localhost:3306/pms`
3. 启动 MySQL（`docker-compose up -d` 或本机 MySQL）
4. 运行 `npm run db:push` 和 `npm run db:seed`
5. 构建并启动: `npm run build && npm run start`

## 项目结构

```
pms-web/
├── prisma/
│   ├── schema.prisma   # 数据模型
│   ├── seed.mjs        # 种子数据
│   └── dev.db          # SQLite 数据库文件
├── src/
│   ├── app/
│   │   ├── (auth)/          # 登录等无需侧边栏的页面
│   │   ├── (dashboard)/     # 主应用页面（带侧边栏）
│   │   └── api/             # API 路由
│   ├── components/          # 通用组件
│   └── lib/                 # 工具库
└── package.json
```

## 功能模块

- 首页数据看板
- 基础信息：楼宇、项目、房源、租客管理
- 收费管理：账单规则、账单、缴纳、退费、催缴
- 物业服务：工单、巡检、NFC、公告、设备
- 系统管理：物业公司、部门、角色、员工（超级管理员可见物业公司）
