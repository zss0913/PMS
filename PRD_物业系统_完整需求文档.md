# 商业写字楼物业管理系统 - 产品需求文档 (PRD)

---

## 文档信息
| 项目名称 | 商业写字楼物业管理系统 |
|---------|----------------------|
| 文档版本 | v1.2.0 |
| 编写日期 | 2025-01-XX |
| 更新日期 | 2025-03-24 |
| 文档状态 | 开发中 |

### 开发进度（与代码一致，2025-03-24）

**PC 管理端（pms-web）**
- **技术栈**：Next.js 16 + React 19 + Tailwind CSS 4 + Prisma
- **数据库**：SQLite（本地开发）/ MySQL（生产上线）
- **能力概览**：登录认证、首页数据看板、楼宇/项目/房源/租客、部门·角色·员工、收费与账单规则、工单（含流程条、操作日志、派单/改派、编辑页、PC 端提交人/处理人「查看电话」弹层）、巡检、公告、卫生吐槽、NFC、设备等
- **开发启动**：`npm run dev`（默认端口 **5001**，建议 `--hostname 0.0.0.0` 便于局域网手机联调）

**租客端 / 员工端：仅 H5（不做微信小程序）**
- **工程**：`PMS/pms-tenant`（租客）、`PMS/pms-staff`（员工）；**uni-app Vue3 + TypeScript**，**仅编译与维护 H5**（`npm run dev:h5` / `npm run build:h5`）。已移除微信小程序依赖与 `manifest` 中 `mp-weixin` 配置。
- **后端 JSON 接口**：路径前缀仍为 **`/api/mp/*`**（历史命名，含义为「移动端门户」），与是否微信小程序无关。主要接口包括：`/api/mp/login`、`/api/mp/me`、`/api/mp/bills`、`/api/mp/work-orders` 及工单子路径、`/api/mp/announcements`、`/api/mp/complaints`、`/api/mp/my-todos`、`/api/mp/inspection-tasks`、`/api/mp/work-order-submit-context`、租客切换租户相关接口等。鉴权：**Bearer**；同域 H5 亦可带 **`pms_token` Cookie**（`getMpAuthUser`）。
- **跨域**：uni-app H5 开发常运行在 **5173**，请求 **5001** 端口 API。Next.js **middleware** 对 **`/api/mp/*`** 与 **`/api/work-orders/upload-image`** 统一返回 CORS 头（含 OPTIONS 预检）。
- **工单图片上传**：`POST /api/work-orders/upload-image`（multipart；另支持 JSON+Base64 以兼容部分环境）。租客/员工 H5 端优先 **`uni.uploadFile`**，失败回退 **`fetch` + FormData**。
- **租客报修提交成功**：跳转 **`uni.redirectTo`** 至报事报修列表（非简单 `navigateBack`）。

**同站轻量 H5（Next `/m/*`，2025-03-21 起）**
- **技术**：Next.js App Router，与上述 **`/api/mp/*`** 及工单、上传等能力共用。
- **访问示例（本地 5001）**：

| 说明 | URL |
|------|-----|
| H5 总入口（选端） | `http://localhost:5001/m` |
| 租客端登录 | `http://localhost:5001/m/tenant/login` |
| 租客端首页（需登录） | `http://localhost:5001/m/tenant` |
| 员工端登录 | `http://localhost:5001/m/staff/login` |
| 员工端首页（需登录） | `http://localhost:5001/m/staff` |
| PC 管理端登录 | `http://localhost:5001/login` |

---

## 目录
- [一、项目概述](#一项目概述)
- [二、系统架构](#二系统架构)
- [三、功能需求](#三功能需求)
  - [3.1 PC端功能](#31-pc端功能)
  - [3.2 租客端 H5 功能](#32-租客端-h5-功能)
  - [3.3 员工端 H5 功能](#33-员工端-h5-功能)
- [四、非功能需求](#四非功能需求)
- [五、数据模型](#五数据模型)
- [六、接口设计](#六接口设计)
- [七、附录](#七附录)

---

## 一、项目概述

### 1.1 项目背景
商业写字楼物业管理系统是一套面向商业写字楼和园区的综合性物业管理SaaS平台，旨在帮助物业公司实现数字化、智能化的管理，提高运营效率，降低管理成本，提升租客满意度。

### 1.2 项目目标
- 实现物业公司多租户数据隔离，支持多个物业公司独立使用
- 实现物业收费的全流程管理（账单生成、缴纳、退费、催缴）
- 实现工单管理和派单流程，提高服务响应速度
- 实现基于NFC的智能巡检管理，确保巡检质量和效率
- 为租客、物业一线人员提供 **移动端 H5**（浏览器访问），提升报修、待办与账单等自助体验

### 1.3 适用范围
- 目标用户：商业写字楼、产业园区的物业管理企业
- 不适用场景：住宅小区物业管理
- 预计规模：5个左右物业公司，每个物业公司最多上千租户

### 1.4 系统特点
- **多租户架构**：不同物业公司数据完全隔离
- **三端协同**：PC 端管理端 + **租客端 H5**（uni-app）+ **员工端 H5**（uni-app）；另可选使用与 PC 同站的 **Next `/m/*`** 轻量 H5
- **智能巡检**：基于NFC的自动巡检管理
- **灵活配置**：支持工单类型、巡检计划、打印模板等自定义配置

---

## 二、系统架构

### 2.1 技术栈
PC 前端技术栈：Next.js + React + TypeScript + Tailwind / shadcn（简洁现代风格，支持暗色模式，响应式设计）
租客端 / 员工端：**uni-app（Vue 3 + TypeScript + Pinia）编译 H5**，浏览器访问；**不交付、不维护微信小程序**
后端技术栈：Node.js + TypeScript + **Next.js API Routes**（与 PC 同仓 `pms-web`）
数据库：MySQL 8.0+
对象存储：本地服务器文件存储
多租户隔离：同一数据库通过租户 ID 隔离

#### 2.1.1 PC Web端
- **前端框架**：Next.js 16（React 19 + TypeScript 5）
- **UI组件库**：shadcn/ui（基于Radix UI）
- **样式方案**：Tailwind CSS 4
- **状态管理**：React Context / Zustand
- **表单管理**：React Hook Form
- **部署方式**：简单部署，支持Docker

#### 2.1.2 租客端 / 员工端（H5）
- **开发框架**：uni-app（**仅输出 H5**，部署为静态站点或配合反向代理）
- **技术语言**：Vue 3 + TypeScript
- **UI**：页面级自定义样式（与项目主题一致）
- **状态管理**：Pinia
- **联调**：开发时 Vite 默认 **5173**，通过代理或 `VITE_API_BASE_URL` 指向 **pms-web :5001**

#### 2.1.3 后端
- **开发语言**：Node.js (TypeScript)
- **Web框架**：Next.js API Routes
- **数据库**：MySQL 8.0
- **ORM**：Prisma
- **认证授权**：JWT

#### 2.1.4 其他
- **对象存储**：本地服务器存储（部署在项目所在服务器）
- **地图服务**：高德地图API
- **消息推送（规划/扩展）**：应用内消息、服务号等；**不以微信小程序订阅消息为交付前提**

### 2.2 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                         租户层                                │
│   物业公司A  │  物业公司B  │  物业公司C  │  物业公司D  │      │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        应用层                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ PC Web端 │  │ 租客端 H5 │  │ 员工端 H5 │                  │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        服务层                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ 用户服务 │  │ 账单服务 │  │ 工单服务 │  │ 巡检服务 │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ 消息服务 │  │ 文件服务 │  │ 日志服务 │  │ 备份服务 │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                        数据层                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │  MySQL   │  │ 文件存储 │  │ Redis缓存│                    │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 部署架构

- **数据库**：MySQL 8.0（支持多租户数据隔离）
- **文件存储**：本地服务器存储
- **备份策略**：自动备份（每天一次，保留30天）+ 手动备份
- **监控策略**：性能监控 + 异常监控 + 日志记录
PC 端端口：5001
支持暗色模式：是
支持响应式设计：是
物业公司数量：约 5 个
租户数量：最多上千个
NFC 标签数量：百到千个
---

## 三、功能需求

### 3.1 PC端功能

#### 3.1.1 首页

**布局结构：**
```
┌─────────────────────────────────────────────────────────────────┐
│                        商业写字楼物业管理系统                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    物业费统计（顶部）                      │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  当前总面积 | 租赁面积 | 自用面积 | 在租租户数 | 在用业主数 │  │
│  │  [数值]      | [数值]    | [数值]    | [数值]       | [数值]      │  │
│  │                                                             │  │
│  │  物业费实时均价                                             │  │
│  │  [数值] 元/平方米                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    数据统计（中部）                        │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  [卡片1: 应收款金额]  [卡片2: 已收款金额]  [卡片3: 退款金额] │  │
│  │  [卡片4: 工单数]      [卡片5: 巡检记录数]                    │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    待办事项列表（底部）                    │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │待派工单  │  │待处理工单│  │待巡检任务│  │逾期账单  │  │  │
│  │  │  [数量]  │  │  [数量]  │  │  [数量]  │  │  [数量]  │  │  │
│  │  │[点击详情]│  │[点击详情]│  │[点击详情]│  │[点击详情]│  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**功能描述：**

**3.1.1.1 物业费统计（顶部卡片）**
- 当前总面积：当前角色能看到的所有楼宇的总面积
- 租赁面积：所有房源状态为"已租"的房源面积之和
- 自用面积：所有房源状态为"自用"的房源面积之和
- 在租租户数：当前活跃的租客数量
- 在用业主数：当前活跃的业主数量
- 物业费实时均价：物业费总额 / 租赁面积

**3.1.1.2 数据统计（中部卡片）**
- 本月应收款金额：当前角色能看到的所有未结清账单的应收金额
- 本月已收款金额：本月已收款的金额
- 本月退款金额：本月已退款的金额
- 本月工单数：本月创建的工单总数
- 本月巡检记录数：本月完成的巡检记录数

**3.1.1.3 待办事项列表（底部卡片）**
- 待派工单：待我派单的工单数量（点击跳转到工单管理-待派单）
- 待处理工单：待我处理的工单数量（点击跳转到工单管理-待处理）
- 待巡检任务：待我巡检的任务数量（点击跳转到巡检任务-待巡检）
- 逾期账单：逾期未结清的账单数量（点击跳转到账单管理-逾期账单）

**数据权限规则：**
- 数据统计：展示当前角色能看到的所有数据范围
- 待办事项：只展示分配给当前用户的数据

---

// Part 1/5 - PC端首页和基础信息管理#### 3.1.2 基础信息管理

**3.1.2.1 楼宇管理**

**功能列表：**
- 楼宇列表：查看楼宇列表，支持新增、编辑、删除、查询筛选
- 楼宇信息：录入楼宇名称、面积、负责人、联系电话、位置等信息
- 楼层管理：创建、编辑、删除楼层（有房源的楼层不能删除）
- 批量创建楼层：输入开始和结束楼层数值，自动生成对应层数，也支持单个创建楼层，楼层号可以手动修改
- 楼层排序：手动拖动调整楼层排序
- 楼层面积：自动计算楼层面积（等于本层所有房源管理面积之和）

**楼宇字段：**
```typescript
{
  id: number;                    // 楼宇ID
  name: string;                  // 楼宇名称
  area: number;                  // 楼宇面积
  manager: string;               // 负责人
  phone: string;                 // 联系电话
  location: string;              // 位置（高德地图坐标）
  companyId: number;             // 所属物业公司ID
  projectId?: number;            // 所属项目ID（创建楼宇时可选）
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**楼层字段：**
```typescript
{
  id: number;                    // 楼层ID
  buildingId: number;            // 所属楼宇ID
  name: string;                  // 楼层名称
  sort: number;                  // 排序
  area: number;                  // 楼层面积（自动计算）
  createdAt: Date;               // 创建时间
}
```

**业务规则：**
1. 创建楼宇时，无需选择所属项目
2. 创建项目时，关联楼宇（至少关联一个）
3. 楼层面积等于本层所有房源管理面积之和
4. 有房源的楼层不能删除

---

**3.1.2.2 项目管理**

**功能列表：**
- 项目列表：查看项目列表，支持新增、编辑、删除、查询筛选
- 项目信息：录入项目名称、位置（高德地图）、占地面积、绿化面积、负责人、联系电话
- 关联楼宇：关联多个楼宇，展示楼宇名称和面积

**项目字段：**
```typescript
{
  id: number;                    // 项目ID
  name: string;                  // 项目名称
  location: string;              // 位置（高德地图坐标）
  area: number;                  // 占地面积
  greenArea: number;             // 绿化面积
  manager: string;               // 负责人
  phone: string;                 // 联系电话
  companyId: number;             // 所属物业公司ID
  buildingIds: number[];         // 关联楼宇ID列表
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 项目需要先创建楼宇，再创建项目时关联楼宇
2. 一个项目可以关联多个楼宇
3. 至少关联一个楼宇

---

**3.1.2.3 房源管理**

**功能列表：**
- 房源列表：查看房源列表，支持新增、编辑、删除、查询筛选
- 房源信息：录入房源名称、房号、管理面积、所属楼宇、所属楼层、房源类型、房源状态、招商状态等字段
- 租客列表：展示房源下所有租客列表（租客名称、租赁面积、租赁起至日期、入住日期）

**房源字段：**
```typescript
{
  id: number;                    // 房源ID
  name: string;                  // 房源名称
  roomNumber: string;            // 房号
  area: number;                  // 管理面积
  buildingId: number;            // 所属楼宇ID
  floorId: number;               // 所属楼层ID
  type: string;                  // 房源类型（商铺/写字楼/住宅）
  status: string;                // 房源状态（空置/已租/自用）
  leasingStatus: string;         // 招商状态（可招商/不可招商）
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**租客列表字段（房源关联）：**
```typescript
{
  tenantId: number;              // 租客ID
  tenantName: string;            // 租客名称
  leaseArea: number;             // 租赁面积
  leaseStartDate: Date;          // 租赁开始日期
  leaseEndDate: Date;            // 租赁结束日期
  moveInDate: Date;              // 入住日期
}
```

**业务规则：**
1. 创建房源时，必须先创建楼层
2. 楼层面积等于本层所有房源管理面积之和
3. 房源类型：商铺、写字楼、住宅
4. 房源状态：空置、已租、自用
5. 招商状态：可招商、不可招商

---

#### 3.1.3 组织架构管理

**3.1.3.1 物业公司管理（仅超级管理员）**

**功能列表：**
- 物业公司列表：展示当前系统中所有物业公司数据，只有超级管理员有这个菜单
- 新建物业公司：再系统中新建物业公司
- 编辑物业公司：在系统中编辑已有物业公司信息
- 删除物业公司：删除已有物业公司，物业公司下已有账号的不能删除
- 查询筛选物业公司：支持根据名称模糊查询筛选物业公司

**物业公司字段：**
```typescript
{
  id: number;                    // 物业公司ID
  name: string;                  // 物业公司名称
  contact: string;               // 联系人
  phone: string;                 // 联系电话
  address: string;               // 地址
  status: string;                // 状态（启用/停用）
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 只有超级管理员可以管理物业公司
2. 物业公司下已有账号的不能删除

---

**3.1.3.2 部门管理**

**功能列表：**
- 部门列表：查看部门列表，支持新增、编辑、删除
- 部门信息：录入部门名称、上级部门、部门负责人、负责项目、负责楼宇、所属物业公司

**部门字段：**
```typescript
{
  id: number;                    // 部门ID
  name: string;                  // 部门名称
  parentId?: number;             // 上级部门ID（可选）
  managerId?: number;            // 部门负责人ID（可选）
  projectIds: number[];          // 负责项目ID列表
  buildingIds: number[];         // 负责楼宇ID列表
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 部门支持多级层级（通过parentId实现）
2. 不选上级部门时，为顶级部门

---

**3.1.3.3 角色管理**

**功能列表：**
- 角色列表：查看角色列表，支持新增、编辑、删除
- 数据权限：配置角色数据权限
- 角色菜单：配置菜单功能权限

**角色字段：**
```typescript
{
  id: number;                    // 角色ID
  name: string;                  // 角色名称
  code: string;                  // 角色编码
  dataScope: string;             // 数据权限范围（全部/本项目/本部门/仅本人）
  menuIds: number[];             // 菜单ID列表
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**数据权限范围：**
- 全部：查看所有数据
- 本项目：查看所属项目的数据
- 本部门：查看所属部门的数据
- 仅本人：仅查看自己的数据

---

**3.1.3.4 物业员工账号管理**

**功能列表：**
- 物业员工账号列表：查看员工列表，支持新增、编辑、删除、启用/禁用
- 物业员工账号信息：录入员工姓名、手机号、密码、所属项目、所属部门、岗位、是否为组长、管理业务类型、所属角色、所属物业公司等

**物业员工字段：**
```typescript
{
  id: number;                    // 员工ID
  name: string;                  // 姓名
  phone: string;                 // 手机号（唯一）
  password: string;              // 密码（加密存储）
  projectId?: number;            // 所属项目ID
  departmentId?: number;         // 所属部门ID
  position: string;              // 岗位（保安/维修工/保洁/其他）
  isLeader: boolean;             // 是否为组长
  businessTypes: string[];       // 管理业务类型（可多选：报修/巡检/设备/绿化/工程等）
  roleId: number;                // 所属角色ID
  companyId: number;             // 所属物业公司ID
  status: string;                // 状态（启用/禁用）
  lastLoginAt?: Date;            // 最后登录时间
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 密码默认123456，可修改
2. 组长可以管理多个业务类型
3. 同一人可以是多个组的组长

---

// Part 2/5 - 组织架构管理和租客管理#### 3.1.4 租客管理

**3.1.4.1 租客管理**

**功能列表：**
- 租客列表：查看租客列表，支持新增、编辑、删除、查询筛选、租户详情
- 租客信息：录入租客类型、公司名称、入住日期、租期起止日期、所属楼宇、租赁房号、租赁面积
- 批量导入：批量导入租客信息，支持下载失败记录

**租客字段：**
```typescript
{
  id: number;                    // 租客ID
  type: string;                  // 租客类型（租客/业主）
  companyName: string;           // 公司名称
  moveInDate: Date;              // 入住日期
  leaseStartDate: Date;          // 租期开始日期
  leaseEndDate: Date;            // 租期结束日期
  buildingId: number;            // 所属楼宇ID
  roomIds: number[];             // 租赁房源ID列表（可多选）
  totalArea: number;             // 租赁总面积
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**批量导入Excel模板字段：**
```
必填字段：
- 租客类型（租客/业主）
- 公司名称
- 入住日期
- 所属楼宇
- 租赁房号
- 租赁面积

选填字段：
- 租期开始日期
- 租期结束日期
```

**业务规则：**
1. 租客创建时，楼层和房源都可以多选
2. 租客只能属于一个楼宇
3. 如果选择多个房源，这些房源必须在同一个楼宇下
4. 导入失败时，生成失败原因表格下载
5. 部分数据导入成功，不影响其他数据

---

**3.1.4.2 租户详情-租客员工管理**

**功能列表：**
- 员工账号列表：查看租客员工列表，支持新增、编辑、删除、启用/禁用
- 员工信息：录入员工手机号、姓名、所属租客、是否为租客管理员、所属楼宇
- 批量导入：批量导入租客员工信息，支持下载失败记录
- 设置租户管理员：系统管理员设置租客管理员

**租客员工字段：**
```typescript
{
  id: number;                    // 员工ID
  phone: string;                 // 手机号（唯一，登录账号）
  name: string;                  // 姓名
  password: string;              // 密码（默认123456）
  tenantIds: number[];           // 所属租客ID列表（可多个租客）
  isAdmin: boolean;              // 是否为租客管理员
  buildingIds: number[];         // 所属楼宇ID列表（可多个楼宇）
  companyId: number;             // 所属物业公司ID
  status: string;                // 状态（启用/禁用）
  lastLoginAt?: Date;            // 最后登录时间
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**批量导入Excel模板字段：**
```
必填字段：
- 手机号
- 姓名
- 所属租客（公司名称）
- 是否为管理员（是/否）

选填字段：
- 所属楼宇（如果只有一个楼宇可不填）
```

**租客邀请员工（租客端 H5）：**
- 租客管理员点击"邀请员工"按钮
- 系统生成唯一邀请码
- 员工扫描邀请码，填写基本信息（手机号、姓名）
- 直接注册为该租客的普通员工

**业务规则：**
1. 租客员工被禁用后无法登录，但历史记录保留
2. 禁用后重新启用，密码不变
3. 租客员工可以属于多个租客、多个楼宇
4. 租客员工在 **H5 顶部**可切换租客和楼宇
5. 租客管理员可以看到租客的账单和催缴信息
6. 普通员工不能查看账单和催缴信息

---

#### 3.1.5 公告管理

**功能列表：**
- 公告列表：查看公告列表，支持新增、编辑、删除
- 公告信息：录入公告标题、内容、附件图片、发布范围、发布时间
- 发布状态：设置公告状态（草稿/已发布）
- 阅读记录：查看公告阅读人数

**公告字段：**
```typescript
{
  id: number;                    // 公告ID
  title: string;                 // 公告标题
  content: string;               // 公告内容（富文本）
  images: string[];              // 附件图片URL列表
  companyId: number;             // 所属物业公司ID
  scope: string;                 // 发布范围（全部楼宇/指定楼宇）
  buildingIds: number[];         // 指定楼宇ID列表
  publishTime?: Date;            // 发布时间
  status: string;                // 状态（草稿/已发布）
  readCount: number;             // 阅读人数
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**公告阅读记录字段：**
```typescript
{
  id: number;                    // 记录ID
  announcementId: number;        // 公告ID
  userId: number;                // 阅读人ID
  userType: string;             // 用户类型（租客员工/物业员工）
  readAt: Date;                  // 阅读时间
}
```

**业务规则：**
1. 公告发布范围可设置为全部楼宇或指定楼宇
2. 租客端只能看到所属楼宇的公告
3. 切换楼宇后，只能看到当前楼宇的公告

---

#### 3.1.6 收费管理

**3.1.6.1 账单规则管理**

**功能列表：**
- 规则列表：查看账单规则列表，支持新增、编辑、删除、启用/停用
- 规则信息：录入规则名称、费用类型、应收金额、折扣率、减免金额、适用租客/楼宇/房源、账期、默认收款账户
- 默认收款账户：在账单规则中设置默认收款账户，缴纳时按照账单的收款账户进行交款

**账单规则字段：**
```typescript
{
  id: number;                    // 规则ID
  name: string;                  // 规则名称
  code: string;                  // 规则编号（系统生成）
  feeType: string;               // 费用类型（物业费/水电费/租金/其他）
  amount: number;                // 应收金额（手动录入）
  discountRate: number;          // 折扣率（百分比）
  discountAmount: number;        // 减免金额
  tenantIds: number[];           // 适用租客ID列表
  buildingIds: number[];         // 适用楼宇ID列表
  roomIds: number[];             // 适用房源ID列表
  periodStartDate: Date;         // 账期开始日期
  periodEndDate: Date;           // 账期结束日期
  accountId: number;             // 默认收款账户ID
  companyId: number;             // 所属物业公司ID
  status: string;                // 状态（启用/停用）
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 账单规则是重复使用的
2. 根据租户、房源、缴费周期不同生成不同的账单
3. 计费方式为手动录入金额，不支持复杂计算逻辑
4. 每次生成账单后，应收金额不可修改
5. 在账单规则中设置默认收款账户
┌─────────────────────────────────────────────────────────────────────────────────┐
│  物业管理系统                            [用户头像] [下拉菜单▼]              [X]  │
├─────────────────────────────────────────────────────────────────────────────────┤
│  首页  基础信息  租客管理  收费管理  物业服务设置  系统管理                     │
│  账单规则  账单管理  缴纳记录  退费记录  催缴管理                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ 📋 账单规则列表                                              [+ 新增规则]  │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ 🔍 搜索规则名称/编号: [___________________]  [搜索]  [重置]               │   │
│  │                                                                         │   │
│  │ 筛选条件: [费用类型▼] [状态▼]                                          │   │
│  │                                                                         │   │
│  │ [✓] 全选    [批量删除]    [导出]                                       │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ ☐ 规则编号   规则名称    费用类型   适用租客   适用楼宇   状态  操作      │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ ☐ BZ-001    物业费规则A   物业费      租客A     A楼      ●启用 [编辑]   │   │
│  │                                             [停用] [删除] [详情]      │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ ☐ BZ-002    水电费规则    水电费      租客B     B楼      ○停用 [编辑]   │   │
│  │                                             [启用] [删除] [详情]      │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ ☐ BZ-003    租金规则     租金        租客C     C楼      ●启用 [编辑]   │   │
│  │                                             [停用] [删除] [详情]      │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ ☐ BZ-004    停车费规则    停车费      租客A     A楼      ●启用 [编辑]   │   │
│  │                                             [停用] [删除] [详情]      │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │ 共 4 条记录  当前第 1 页  共 1 页                                        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
---

**3.1.6.2 账单管理**

**功能列表：**
- 账单列表：查看账单列表，支持新增、批量删除、导出
- 账单信息：基于规则生成账单，录入应收日期、备注
- 账单详情：查看账单详情（应收金额、已缴纳金额、需缴纳金额、账单状态、结清状态）
- 账单状态管理：开启/关闭账单
- 线下缴费：录入线下缴费记录
- 退费：创建退费记录
- 催缴：一键发送催缴通知
- 打印催缴单：选择模板打印催缴单
- 打印收据：选择模板打印收据
- 操作日志：查看账单操作日志

**账单字段：**
```typescript
{
  id: number;                    // 账单ID
  code: string;                  // 账单编号（系统生成）
  ruleId: number;                // 规则ID
  ruleName: string;              // 规则名称
  projectId: number;             // 所属项目ID
  buildingId: number;            // 所属楼宇ID
  roomId: number;                // 所属房源ID
  tenantId: number;              // 所属租客ID
  feeType: string;               // 费用类型
  period: string;                // 账期
  accountReceivable: number;     // 应收金额（生成后不可修改）
  amountPaid: number;            // 已缴纳金额（动态计算）
  amountDue: number;             // 需缴纳金额（动态计算）
  status: string;                // 账单状态（开启/关闭）
  paymentStatus: string;         // 结清状态（未缴纳/部分缴纳/已结清）
  dueDate: Date;                 // 应收日期
  accountId: number;             // 收款账户ID
  remark: string;                // 备注
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**缴纳记录字段（账单关联）：**
```typescript
{
  id: number;                    // 记录ID
  code: string;                  // 缴纳编号（系统生成）
  tenantId: number;              // 关联租客
  paidAt: Date;                  // 缴纳时间
  payer: string;                 // 缴纳人
  totalAmount: number;           // 缴纳总额
  paymentMethod: string;         // 支付方式（微信支付/现金/转账/其他）
  paymentStatus: string;         // 支付状态（成功/失败）
  transactionId?: string;        // 交易号（微信支付返回）
  operatorId: number;            // 操作人ID
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
}
```

**账单分配明细字段：**
```typescript
{
  id: number;                    // 明细ID
  paymentId: number;             // 缴纳记录ID
  billId: number;                // 账单ID
  billCode: string;              // 账单编号
  amount: number;                // 本次缴纳金额
  amountDueBefore: number;       // 缴纳前需缴纳金额
  amountDueAfter: number;        // 缴纳后需缴纳金额
}
```

**退费记录字段（账单关联）：**
```typescript
{
  id: number;                    // 退费ID
  code: string;                  // 退费编号（系统生成）
  billId: number;                // 关联账单ID
  tenantId: number;              // 所属租客ID
  refundAt: Date;                // 退费时间
  refunder: string;              // 退费人
  operatorId: number;            // 操作人ID
  amount: number;                // 退费金额
  reason: string;                // 退费原因
  remark: string;                // 备注
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
}
```

**账单操作日志字段：**
```typescript
{
  id: number;                    // 日志ID
  billId: number;                // 关联账单ID
  operatorId: number;            // 操作人ID
  operatedAt: Date;              // 操作时间
  operationType: string;         // 操作类型（创建/缴费/退费/催缴/修改/关闭/开启/打印催缴单/打印收据）
  detail: string;                // 操作详情（JSON格式）
}
```

**业务规则：**

**1. 缴纳逻辑：**
- 租客可以多次支付直到结清为止
- 每次缴纳一部分钱后，账单的待缴纳金额会变少，已缴纳金额会变多
- 生成账单的缴纳记录，在账单详情中可查看
- 租客可以一次缴纳多个账单的金额
- 一次缴纳多个账单时，系统自动按账单时间顺序从旧到新分配金额，直到用完本次所有缴纳金额为止
- 缴纳记录需要关联租户

**金额计算公式：**
```
账单需缴纳金额 = 应收金额 - （当前账单所有缴纳记录中本账单缴纳金额之和）+ （当前账单所有退费记录中本账单退费金额之和）

账单已缴纳金额 = 当前账单下所有缴纳记录中本账单缴纳金额之和 - 当前账单下所有退费记录中本账单退费金额之和
```

**2. 退费逻辑：**
- 退费不需要关联缴纳记录，只需要创建退费记录
- 退费后，账单中的已缴纳金额减去本次退费金额，需缴纳金额相应增加
- 账单结清状态自动更新
- 退费记录在账单详情中展示
- 一个账单可进行多条退费
- 每次退费金额不能大于账单当前已缴纳金额

**3. 催缴逻辑：**
- 不需要次数限制，由财务人员人为控制
- 支持一键服务通知（**应用内消息** + 服务号消息通知等，按实现为准）
- 支持打印纸质催缴单
- 自动催缴功能：设置每月几号的几点自动发送，仅发送已逾期的账单
- 催缴记录需要专门的菜单管理
- 账单被催缴后，在操作日志中展示

**4. 打印逻辑：**
- 打印催缴单是PC端功能
- 打印后不需要保存打印记录，只在账单下创建操作记录"打印催缴单"
- 打印收据是PC端功能
- 打印模板在系统管理中配置

---

// Part 3/5 - 收费管理（继续）和物业服务设置**3.1.6.3 缴纳记录管理**

**功能列表：**
- 缴纳列表：查看所有缴纳记录，支持导出
- 缴纳详情：查看缴纳详情（缴纳总额、各账单缴纳金额）

**缴纳记录管理字段：**
```typescript
{
  id: number;                    // 记录ID
  code: string;                  // 缴纳编号
  tenantId: number;              // 关联租客
  totalAmount: number;           // 缴纳总额
  paymentMethod: string;         // 支付方式
  paymentStatus: string;         // 支付状态
  transactionId?: string;        // 交易号
  paidAt: Date;                  // 缴纳时间
  operatorId: number;            // 操作人ID
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
}
```

**账单分配明细列表（子表）：**
```typescript
{
  billId: number;                // 账单ID
  billCode: string;              // 账单编号
  amount: number;                // 本次缴纳金额
  amountDueBefore: number;       // 缴纳前需缴纳金额
  amountDueAfter: number;        // 缴纳后需缴纳金额
}
```

---

**3.1.6.4 退费记录管理**

**功能列表：**
- 退费列表：查看所有退费记录，支持导出
- 退费详情：查看退费详情

**退费记录管理字段：**
```typescript
{
  id: number;                    // 退费ID
  code: string;                  // 退费编号
  billId: number;                // 关联账单
  tenantId: number;              // 所属租客
  amount: number;                // 退费金额
  reason: string;                // 退费原因
  remark: string;                // 备注
  refundAt: Date;                // 退费时间
  operatorId: number;            // 操作人ID
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
}
```

---

**3.1.6.5 催缴管理**

**功能列表：**
- 催缴列表：查看所有催缴记录，支持导出
- 催缴详情：查看催缴详情
- 自动催缴设置：设置自动催缴（开关、日期、时间）

**催缴记录字段：**
```typescript
{
  id: number;                    // 催缴ID
  code: string;                  // 催缴编号
  billIds: number[];             // 关联账单ID列表
  method: string;                // 催缴方式（一键通知/打印纸质/自动发送）
  content: string;               // 催缴内容
  notifyTargetId: number;        // 通知对象（租客管理员ID）
  status: string;                // 催缴状态（成功/失败）
  sentAt: Date;                  // 催缴时间
  operatorId: number;            // 催缴人ID
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
}
```

**自动催缴设置字段：**
```typescript
{
  id: number;                    // 设置ID
  isEnabled: boolean;            // 自动催缴开关
  sendDay: number;               // 发送日期（每月几号）
  sendTime: string;              // 发送时间（几点）
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 自动催缴只发送已逾期的账单
2. 发送方式：**应用内消息** + 服务号消息通知（按实现为准）
3. 催缴记录需要专门的管理菜单

---

**3.1.6.6 打印模板管理**

**功能列表：**
- 打印模板列表：查看打印模板列表，支持新增、编辑、删除
- 打印模板信息：录入模板名称、模板类型、模板DOCX

**打印模板字段：**
```typescript
{
  id: number;                    // 模板ID
  name: string;                  // 模板名称
  type: string;                  // 模板类型（催缴单/收据）
  templateUrl: string;           // 模板文件URL（docx格式）
  fields: string;                // 模板字段配置（JSON格式）
  companyId: number;             // 所属物业公司ID
  status: string;                // 状态（启用/停用）
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**催缴单模板字段配置：**
```typescript
{
  tenantName: string;            // 租客名称
  buildingName: string;          // 所属楼宇
  leaseArea: number;             // 租赁面积
  roomNumber: string;            // 房号
  billList: Array<{              // 需缴纳账单列表
    amountDue: number;           // 需缴金额
    dueDate: Date;               // 应缴费日期
    feeType: string;             // 费用类型
    overdueDays: number;         // 逾期天数
  }>;
  totalAmount: number;           // 需缴纳合计
  account: {                     // 收款账户信息
    bankName: string;            // 开户行
    accountNumber: string;       // 银行账号
  };
  propertyName: string;          // 物业公司
  notifyTime: Date;              // 通知时间
}
```

**打印催缴单流程：**
1. 选择需要催缴的账单
2. 选择催缴模板
3. 按租户生成每个租户的催缴单
4. 每个租户的多个账单在一张催缴单上

---

#### 3.1.7 物业服务设置

**3.1.7.1 NFC标签管理**

**功能列表：**
- NFC标签列表：查看NFC列表，支持新增、编辑、删除，查询筛选、批量导入

**NFC标签字段：**
```typescript
{
  id: number;                    // 标签ID
  tagId: string;                 // NFCID（唯一）
  location: string;              // 具体位置
  description: string;           // 说明
  inspectionType: string;        // 巡检类型
  buildingId: number;            // 所属楼宇
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**批量导入Excel模板字段：**
```
必填字段：
- NFCID（唯一）
- 巡检类型
- 具体位置
- 说明
```

**业务规则：**
1. NFC标签在PC端手动输入标签ID录入
2. 支持批量导入
3. 导入时需要判断NFCID不能和当前企业下已有的NFCID一致
4. 一条上传失败不影响其他数据上传
5. 上传完成后可下载失败记录表，包含失败数据和失败原因
6. 每个NFC标签只能绑定一种巡检类型的一个巡检点

---

**3.1.7.2 巡检计划管理**

**功能列表：**
- 巡检计划列表：查看巡检计划列表，支持新增、编辑、删除、启用/停用

**巡检计划字段：**
```typescript
{
  id: number;                    // 计划ID
  name: string;                  // 计划名称
  inspectionType: string;        // 巡检类型（工程/安保/设备/绿化）
  cycleType: string;             // 周期类型（每天/每周/每月/自定义天数/自定义月数）
  cycleValue: number;            // 周期值（如：每3天，cycleValue=3）
  userIds: number[];             // 巡检人员ID列表
  route: string;                 // 巡检路线（JSON格式，包含多个NFC检查点）
  checkItems: string;            // 检查项目列表（JSON格式，整个路线共享）
  companyId: number;             // 所属物业公司ID
  status: string;                // 状态（启用/停用）
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 每个巡检类型只能有一个启用状态的巡检计划
2. 新计划启用时，同类型的旧计划自动停用
3. 巡检周期支持：每天、每周、每月、每N天、每N月
4. 巡检任务每天凌晨0:00根据巡检计划自动生成下一天的巡检任务
5. 巡检任务完成后自动生成巡检记录
6. 巡检任务生成后，所有负责该类型巡检的人员都可以看到该任务
7. 谁去完成该巡检任务，巡检记录中就记录是谁完成的

---

**3.1.7.3 巡检任务管理**

**功能列表：**
- 巡检任务列表：查看巡检任务列表

**巡检任务字段：**
```typescript
{
  id: number;                    // 任务ID
  code: string;                  // 任务编号（系统生成）
  planId: number;                // 所属计划ID
  planName: string;              // 计划名称
  inspectionType: string;        // 巡检类型
  scheduledDate: Date;           // 计划巡检日期
  userIds: number[];             // 巡检人员ID列表
  route: string;                 // 巡检路线（继承计划）
  checkItems: string;            // 检查项目列表（继承计划）
  status: string;                // 任务状态（待巡检/进行中/已完成/未完成）
  startedAt?: Date;              // 开始时间
  completedAt?: Date;            // 完成时间
  completedBy?: number;          // 完成人ID
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 巡检任务未完成时，需要系统提醒
2. 巡检任务不能延期
3. 员工可以自由选择感应NFC的顺序，只要把PC端巡检计划设定的所有NFC都感应完，巡检就算自动完成

---

**3.1.7.4 巡检记录管理**

**功能列表：**
- 巡检记录列表：查看巡检记录列表，支持导出
- 巡检记录详情：查看巡检记录详情
- 巡检操作日志：查看巡检操作日志

**巡检记录字段：**
```typescript
{
  id: number;                    // 记录ID
  taskId: number;                // 巡检任务ID
  taskCode: string;              // 任务编号
  inspectionType: string;        // 巡检类型
  tagId: string;                 // NFC标签ID
  location: string;              // 位置名称
  checkedAt: Date;               // 检查时间
  checkedBy: number;             // 检查人ID
  status: string;                // 巡检状态（正常/异常）
  checkItems: string;            // 检查项目列表（JSON格式）
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
}
```

**检查项目字段：**
```typescript
{
  itemName: string;              // 检查项目名称
  result: string;                // 检查结果（正常/异常）
  severity?: string;             // 异常严重级别（低/中/高）
  description?: string;          // 异常描述
  images?: string[];             // 异常照片
}
```

**巡检操作日志字段：**
```typescript
{
  id: number;                    // 日志ID
  taskId: number;                // 关联巡检任务ID
  operatorId: number;            // 操作人ID
  operatedAt: Date;              // 操作时间
  operationType: string;         // 操作类型（创建/开始/完成/异常上报）
  detail: string;                // 操作详情（JSON格式）
}
```

**业务规则：**
1. 巡检发现异常后，需要自动生成维修工单
2. 异常需要拍照，并标记工单类型为巡检发现
3. 异常问题需要区分严重级别（至少3个级别）

---

// Part 4/5 - 物业服务设置（工单、设备、卫生吐槽）和系统管理**3.1.7.5 工单类型管理**

**功能列表：**
- 工单类型列表：查看工单类型列表，支持新增、编辑、删除

**工单类型字段：**
```typescript
{
  id: number;                    // 类型ID
  name: string;                  // 类型名称
  sort: number;                  // 排序
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 工单类型是物业公司下全局共享的
2. 工单类型需要自定义维护，不是写死固定的

---

**3.1.7.6 工单超时设置**

**功能列表：**
- 工单超时设置列表：查看超时设置列表

**工单超时设置字段：**
```typescript
{
  id: number;                    // 设置ID
  workOrderType: string;         // 工单类型
  responseTimeout: number;       // 响应超时时间（小时）默认2小时
  processTimeout: string;        // 处理超时（通知组长）
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

---

**3.1.7.7 工单管理**

**功能列表：**
- 工单列表：按状态 Tab 筛选；可按创建时间范围、类型、来源、租客/处理人模糊查询；**来源**口径：**PC自建**、**员工端自建**、**租客自建**、**巡检发现**（列表/详情展示时将历史值 `租客端`→租客自建、`PC端`→PC自建）；展示设施范围（租客端）等字段
- 新建工单（PC）：楼宇**必填**；房源、租客**选填**；来源自动识别为「PC自建」，若新建页 URL 带 `?source=巡检发现` 则为巡检发现；工单类型取自「工单类型」配置；**描述必填**；图片**选填**（图片 URL，每行一条，存 JSON 数组）
- 工单详情：派单；流程操作（开始处理、提交费用待确认、办结待评价、标记评价完成、取消）；提交人/处理人 **查看电话**（点击后在弹层展示号码，避免列表页直接暴露）
- 租客端报事报修：见下「租客端规则」；相关 API：`POST /api/mp/work-orders`、`GET /api/mp/work-order-submit-context`、`POST /api/mp/work-orders/{id}/confirm-fee`
- 员工端列表：`GET /api/mp/work-orders`（与租客端 H5 共用同一套移动端接口，按登录类型过滤）
- 多状态：**待派单 / 待响应 / 处理中 / 待确认费用（可选）/ 待评价 / 评价完成 / 已取消**
- 状态推进（PC）：`POST /api/work-orders/{id}/advance`，`action` 取值：`start_processing` | `request_fee_confirmation` | `complete_for_evaluation` | `mark_evaluated` | `cancel`（`request_fee_confirmation` 可带 `feeRemark`）

**租客端报事报修规则：**
1. 类型仅为 **报事**、**报修**（写入工单 `type` 字段）。
2. 必选 **公共设施 / 套内设施**（`facilityScope`）。选择**套内设施**时，须勾选已阅读「可能产生费用、具体金额以工程师上门评估为准」类提示（`feeNoticeAcknowledged=true`）方可提交。
3. **描述必填**；**图片选填**（URL 数组，**最多 10 张**，单张 ≤10MB，PNG/JPG）；可选填 `location` 文字说明位置。
4. **楼宇、房源、租客不展示**：由当前登录租客账号关联自动解析（默认：关联的第一个租客主体 + 该租客下第一张绑定房源；无绑定房源时 `roomId` 可为空）。
5. 来源固定为 **租客自建**（历史数据可能仍为 `租客端`，筛选与展示时与租客自建等价）；创建后状态为 **待派单**。
6. **待确认费用**：员工在 PC 端提交后，租客在 **H5（或同站 `/m/tenant`）** 调用 **确认费用** 接口（如 `POST /api/mp/work-orders/{id}/confirm-fee`），工单回到 **处理中** 继续维修。

**员工端（PC）自建规则：**
1. 楼宇必填；房源、租客选填（若同时选择，系统校验租客是否绑定该房源）。
2. 来源无需手选：默认 **PC自建**；巡检等入口跳转新建页时带 `source=巡检发现`。
3. 描述必填；图片选填。

**工单字段（核心，与实现一致）：**
```typescript
{
  id: number;
  code: string;
  projectId?: number;
  buildingId: number;
  roomId?: number | null;       // 可选：公区工单等
  tenantId?: number | null;
  reporterId: number;           // 员工ID 或 租客用户ID
  source: string;               // PC自建 | 员工端自建 | 租客自建 | 巡检发现（兼容旧值 租客端、PC端）
  type: string;                 // 租客端为报事/报修；PC 为工单类型配置名称
  title: string;
  description: string;
  images?: string | null;       // JSON 字符串：图片 URL 数组
  location?: string | null;
  facilityScope?: string | null;        // 公共设施 | 套内设施
  feeNoticeAcknowledged: boolean;
  feeRemark?: string | null;            // 待确认费用说明
  feeConfirmedAt?: Date | null;
  severity?: string;
  taskId?: number;
  tagId?: string;
  status: string;               // 含 待确认费用
  assignedAt?: Date;
  assignedTo?: number;
  respondedAt?: Date;
  completedAt?: Date;
  evaluatedAt?: Date;
  companyId: number;
  createdAt: Date;
  updatedAt: Date;
}
```

**工单处理记录字段：**
```typescript
{
  id: number;                    // 处理ID
  workOrderId: number;           // 工单ID
  handlerId: number;             // 处理人ID
  content: string;               // 处理内容
  images: string[];              // 处理图片（可多张）
  status: string;                // 处理状态（处理中/已完成）
  handledAt: Date;               // 处理时间
}
```

**工单评价字段：**
```typescript
{
  id: number;                    // 评价ID
  workOrderId: number;           // 工单ID
  evaluatorId: number;           // 评价人ID
  rating: number;                // 评分（1-5星）
  content: string;               // 评价内容
  evaluatedAt: Date;             // 评价时间
}
```

**工单操作日志字段：**
```typescript
{
  id: number;                    // 日志ID
  workOrderId: number;           // 关联工单ID
  operatorId: number;            // 操作人ID
  operatedAt: Date;              // 操作时间
  operationType: string;         // 操作类型（创建/派单/响应/处理/完成/评价/取消）
  detail: string;                // 操作详情（JSON格式）
}
```

**工单流转流程：**
1. 工单创建 → **待派单**
2. 派单给处理人 → **待响应**
3. 处理人「开始处理」→ **处理中**
4. （可选）涉及有偿且需租客确认：「提交费用待确认」→ **待确认费用** → 租客 **H5** 确认 → **处理中**
5. 「办结并进入待评价」→ **待评价**
6. 「标记评价完成」→ **评价完成**
7. 待派单/待响应/处理中可 **取消** → **已取消**
8. 超时未响应 → 系统提醒组长 → 组长重新派单或催促（与工单类型超时配置配合）

**工单超时机制：**
- 默认响应超时时间：2小时
- 处理超时：通知组长
- 超时后发送通知给组长
- 组长可选择重新派单或催促师傅

**重新派单逻辑：**
- 需要记录原派单人员信息
- 重新派单后，师傅A下面的工单失效，已经被派给其他人
- 师傅A可以看到自己曾经派过的工单记录

**巡检异常生成工单逻辑：**
- 巡检发现异常后，需要弹出表单让员工填写工单类型、标题、描述等信息
- 工单来源标记为"巡检发现"
- 包含异常照片和严重级别

**业务规则：**
1. 不同状态的工单在不同table中展示，所有状态的工单在同一个页面
2. 排序规则：按创建时间倒序排列
3. 筛选条件：时间、工单类型、处理人
4. 不支持拒单，只能由组长进行重新派单

---

**3.1.7.8 组长配置**

**功能列表：**
- 组长配置列表：查看组长配置列表
- 组长配置：配置不同业务类型的组长

**组长配置字段：**
```typescript
{
  id: number;                    // 配置ID
  businessType: string;          // 业务类型（报修/巡检/设备/绿化/工程等）
  projectId: number;             // 项目ID
  leaderId: number;              // 组长员工ID
  status: string;                // 状态（启用/停用）
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**业务规则：**
1. 不同业务类型的工单通知不同的组长
2. 同一个人可以负责多个业务
3. 新工单通知特定组长

---

**3.1.7.9 巡检任务组长配置**

**功能列表：**
- 巡检组长配置列表：查看巡检组长配置列表
- 巡检组长配置：配置巡检任务的组长

**巡检组长配置字段：**
```typescript
{
  id: number;                    // 配置ID
  inspectionType: string;        // 巡检类型
  projectId: number;             // 项目ID
  leaderId: number;              // 组长员工ID
  status: string;                // 状态（启用/停用）
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**巡检超时提醒逻辑：**
- 巡检任务超时未完成需要 **应用内通知**（或短信/服务号等，按实现为准）
- 发送服务号订阅消息通知
- 通知对象为特定巡检任务组长

---

**3.1.7.10 设备台账**

**功能列表：**
- 设备列表：查看设备列表，支持新增、编辑、删除
- 设备信息：录入设备编号、名称、类型、位置、投入使用日期、供应商、NFC标签

**设备字段：**
```typescript
{
  id: number;                    // 设备ID
  code: string;                  // 设备编号
  name: string;                  // 设备名称
  type: string;                  // 设备类型
  location: string;              // 所在位置
  buildingId: number;            // 所属楼宇ID
  commissionedDate: Date;        // 投入使用日期
  supplier: string;              // 供应商
  contactPhone: string;          // 联系电话
  tagId?: string;                // NFC标签ID
  status: string;                // 设备状态（正常/维修中/报废）
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

---

**3.1.7.11 设备维保记录**

**功能列表：**
- 维保列表：查看设备维保记录
- 维保信息：录入维保类型、日期、人员、费用、内容

**维保记录字段：**
```typescript
{
  id: number;                    // 维保ID
  code: string;                  // 维保编号（系统生成）
  deviceId: number;              // 设备ID
  type: string;                  // 维保类型（日常保养/故障维修/定期检查）
  date: Date;                    // 维保日期
  maintainerId: number;          // 维保人员ID
  cost: number;                  // 费用
  content: string;               // 维保内容
  images: string[];              // 维保图片
  remark: string;                // 备注
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
}
```

---

**3.1.7.12 卫生吐槽管理**

**功能列表：**
- 吐槽列表：查看吐槽列表
- 吐槽详情：查看吐槽详情，支持分配处理人员、记录处理结果

**吐槽记录字段：**
```typescript
{
  id: number;                    // 吐槽ID
  projectId: number;             // 所属项目ID
  buildingId: number;            // 所属楼宇ID
  tenantId: number;              // 所属租客ID
  reporterId: number;            // 提报人ID
  location: string;              // 位置描述
  description: string;           // 问题描述
  images: string[];              // 问题图片
  status: string;                // 处理状态（待处理/处理中/已完成）
  assignedAt?: Date;             // 分配时间
  assignedTo?: number;           // 分配给
  handledBy?: number;            // 处理人ID
  handledAt?: Date;              // 处理时间
  result: string;                // 处理结果
  resultImages: string[];        // 处理图片
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

---

#### 3.1.8 系统管理

**3.1.8.1 字典管理**

**功能列表：**
- 字典列表：查看字典列表，支持新增、编辑、删除
- 字典信息：录入字典信息

**字典字段：**
```typescript
{
  id: number;                    // 字典ID
  type: string;                  // 字典类型
  name: string;                  // 字典名称
  value: string;                 // 字典值
  sort: number;                  // 排序
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

---

**3.1.8.2 系统参数**

**功能列表：**
- 参数配置：配置系统参数

**系统参数字段：**
```typescript
{
  id: number;                    // 参数ID
  key: string;                   // 参数键
  value: string;                 // 参数值
  description: string;           // 描述
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

---

**3.1.8.3 系统日志**

**功能列表：**
- 登录日志：查看用户登录日志
- 操作日志：查看用户操作日志

**登录日志字段：**
```typescript
{
  id: number;                    // 日志ID
  userId: number;                // 用户ID
  userType: string;              // 用户类型（物业员工/租客员工）
  loginAt: Date;                 // 登录时间
  ip: string;                    // IP地址
  userAgent: string;             // 用户代理
  status: string;                // 登录状态（成功/失败）
  companyId: number;             // 所属物业公司ID
}
```

**操作日志字段：**
```typescript
{
  id: number;                    // 日志ID
  userId: number;                // 用户ID
  userType: string;              // 用户类型（物业员工/租客员工）
  module: string;                // 模块
  operation: string;             // 操作
  detail: string;                // 详情（JSON格式）
  operatedAt: Date;              // 操作时间
  ip: string;                    // IP地址
  companyId: number;             // 所属物业公司ID
}
```

---

**3.1.8.4 系统监控**

**功能列表：**
- 性能监控：监控系统性能
- 异常监控：监控系统异常

**监控指标：**
- CPU使用率
- 内存使用率
- 磁盘使用率
- 接口响应时间
- 错误率

---

**3.1.8.5 数据备份**

**功能列表：**
- 自动备份：系统自动备份数据库（每天一次，保留30天）
- 手动备份：支持手动备份
- 数据恢复：支持从备份恢复

**备份记录字段：**
```typescript
{
  id: number;                    // 备份ID
  fileName: string;              // 备份文件名
  fileSize: number;              // 文件大小
  backupType: string;            // 备份类型（自动/手动）
  backupAt: Date;                // 备份时间
  operatorId?: number;           // 操作人ID（手动备份）
  companyId: number;             // 所属物业公司ID
}
```

---

**3.1.8.6 收款账户管理**

**功能列表：**
- 账户列表：查看收款账户列表，支持新增、编辑、删除
- 账户信息：录入账户名称、开户行、银行账号

**收款账户字段：**
```typescript
{
  id: number;                    // 账户ID
  name: string;                  // 账户名称
  bankName: string;              // 开户行
  accountNumber: string;         // 银行账号
  companyId: number;             // 所属物业公司ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

---

### 3.2 租客端 H5 功能

> **交付形态**：浏览器中打开的 **uni-app H5**（`pms-tenant`）。**不包含微信小程序。** 功能描述下同站 **`/m/tenant/*`** 与其对齐，便于产品对照测试。

**3.2.1 首页**

**功能列表：**
- 登录：账号密码登录、账号密码验证，支持记住密码
- 物业费统计：当前总面积、租赁面积、自用面积、在租租户数量、在用业主数量、物业费实时均价
- 数据统计：展示数据权限下本月应收款金额、本月已收款金额、本月退款金额、本月工单数、本月巡检记录数
- 待办事项列表：待派工单列表、待处理工单列表、待巡检任务列表、逾期账单列表，这里的数据仅展示当前待我处理的，点击数据可跳转到对应详情页面



---

**3.2.2 账单管理**

**功能列表：**
- 账单列表：查看当前租客账单列表（仅租客管理员可看）
- 账单详情：查看账单详情（应收金额、已缴纳金额、需缴纳金额、缴纳记录）
- 账单支付：微信支付账单
- 批量支付：选择多个账单批量支付
- 缴纳记录：查看缴纳记录详情
- 退费记录：查看退费记录详情

**业务规则：**
1. 普通员工点击账单菜单时，提示"无权限"
2. 租客管理员可以看到当前租客的账单和催缴信息

---

**3.2.3 报事报修**

**功能列表：**
- 提交报事报修：类型（报事/报修）、设施范围（公共设施/套内设施；套内需费用知情勾选）、标题与描述、**现场照片（最多 10 张）**、位置说明；提交成功后 **自动进入报事报修列表**
- 工单列表：查看我的工单列表，按状态区分展示，点击进入工单详情
- 工单详情：流程节点、字段与 **操作日志（时间轴）**、待确认费用、编辑/取消（按状态）；提交人/处理人旁可 **拨号**（`tel:`）
- 工单评价：对完成的工单进行评价（1-5星+评价内容）（按实现进度）

---

**3.2.4 公告查看**

**功能列表：**
- 公告列表：查看当前楼宇的公告列表
- 公告详情：查看公告详情

---

**3.2.5 卫生吐槽**

**功能列表：**
- 提交吐槽：选择位置、描述问题、上传图片
- 吐槽列表：查看我的吐槽列表
- 吐槽详情：查看吐槽详情和处理进度

---

**3.2.6 消息通知**

**功能列表：**
- 消息列表：查看 **应用内通知**（账单催缴、工单、公告等）
- 消息跳转：点击通知跳转到对应详情页面

**通知类型：**
- 账单催缴通知
- 工单通知
- 公告通知

---

**3.2.7 员工管理（仅租客管理员）**

**功能列表：**
- 邀请员工：点击邀请按钮，生成唯一邀请码
- 移除员工：移除租客下的员工
- 员工列表：查看员工信息

**租客邀请员工流程：**
1. 租客管理员点击"邀请员工"按钮
2. 系统生成唯一邀请码
3. 分享邀请码
4. 员工扫描邀请码，填写基本信息（手机号、姓名）
5. 直接注册为该租客的普通员工

---

**3.2.8 个人中心**

**功能列表：**
- 个人信息：查看个人信息
- 修改密码：输入原密码和新密码，修改密码
- 关于：版本号展示
- 关于我们：关于我们的介绍

---

**3.2.9 楼宇切换**

**功能列表：**
- 切换楼宇：顶部切换当前查看的楼宇
- 切换租客：顶部切换当前查看的租客（同一楼宇下多租客）

**业务规则：**
1. 租客员工可以属于多个租客、多个楼宇
2. 租客员工登录后，可以切换到自己所属的租客的楼宇
3. 是租客员工切换楼宇，不是租客本身切换

---

### 3.3 员工端 H5 功能

> **交付形态**：浏览器中打开的 **uni-app H5**（`pms-staff`）。**不包含微信小程序。**

**3.3.1 首页**

**功能列表：**
- 登录：使用手机号 + 密码登录
- 记住密码：支持记住密码
- 我的待办：待派工单列表、待处理工单列表、待巡检任务列表、逾期账单列表

---

**3.3.2 工单管理**

**功能列表：**
- 工单待办：待我处理的工单列表，可进入详情处理工单
- 工单列表：查看工单列表按照不同状态区分table列表展示，点击可进入工单详情，支持查看我提交的
- 工单详情：查看工单信息进入详情页面
- 接单处理：填写处理记录（文字 + 图片），完成工单

---

**3.3.3 巡检管理**

**功能列表：**
- 巡检任务：查看待巡检任务列表
- 巡检任务详情：查看巡检任务详情（路线和检查点）开始巡检，进行NFC感应，感应完本次巡检任务中关联的所有NFC则巡检自动完成
- 执行巡检 - NFC感应：按路线顺序或者自由顺序感应NFC标签，根据巡检计划要求进行
- 执行巡检 - 检查项目：对每个检查项目标记正常/异常
- 执行巡检 - 异常上报：异常拍照、选择严重级别、自动生成工单需要手工填写工单信息
- 巡检记录：查看已完成巡检记录
- 巡检记录详情：查看巡检记录详情

**业务规则：**
1. 员工可以自由选择感应NFC的顺序，只要把PC端巡检计划设定的所有NFC都感应完，巡检就算自动完成
2. 巡检发现异常后，需要弹出表单让员工填写工单类型、标题、描述等信息
3. 异常需要拍照，并选择严重级别

---

**3.3.4 公告查看**

**功能列表：**
- 公告列表：查看公告列表
- 公告详情：查看公告详情

---

**3.3.5 消息通知**

**功能列表：**
- 消息列表：查看 **应用内通知**（工单、巡检、公告等）
- 消息跳转：点击通知跳转到对应详情页面

**通知类型：**
- 工单通知（派单通知、超时提醒）
- 巡检通知（任务提醒、超时提醒）
- 公告通知

---

**3.3.6 个人中心**

**功能列表：**
- 个人信息：查看信息
- 修改密码：输入原密码和新密码，修改密码
- 关于：版本号展示
- 关于我们：关于我们的介绍

---

## 四、非功能需求

### 4.1 性能需求

**4.1.1 响应时间**
- 页面加载时间：首屏加载时间 < 3秒
- 接口响应时间：一般接口 < 1秒，复杂查询 < 3秒
- 文件上传速度：支持10MB以内的图片上传

**4.1.2 并发能力**
- 支持至少500个用户同时在线
- 支持每秒100个并发请求

**4.1.3 数据量**
- 支持单个物业公司管理10000个NFC标签
- 支持单个物业公司管理1000个租客
- 支持单个物业公司管理10000个账单

---

### 4.2 安全需求

**4.2.1 数据安全**
- 密码加密存储（使用bcrypt加密）
- 手机号明文存储
- 敏感操作需要二次验证（如：删除数据）
- 数据传输使用HTTPS加密

**4.2.2 访问控制**
- 基于角色的访问控制（RBAC）
- 基于数据权限的数据隔离
- 不同物业公司数据完全隔离
- 接口鉴权使用JWT Token

**4.2.3 操作审计**
- 记录所有用户登录日志
- 记录关键业务操作日志（账单、工单、巡检）
- 日志保留时间至少90天

---

### 4.3 可用性需求

**4.3.1 系统可用性**
- 系统可用性 ≥ 99.5%
- 系统故障恢复时间 < 30分钟

**4.3.2 数据备份**
- 自动备份：每天一次，保留30天
- 手动备份：支持手动触发备份
- 数据恢复：支持从备份恢复

**4.3.3 容错处理**
- 接口异常处理：统一异常处理和错误提示
- 网络异常：支持离线缓存，网络恢复后自动同步
- 数据验证：前端和后端双重验证

---

### 4.4 可维护性需求

**4.4.1 代码规范**
- 遵循ESLint代码规范
- 使用TypeScript类型检查
- 代码注释完整

**4.4.2 日志记录**
- 系统日志：记录系统运行日志
- 业务日志：记录关键业务操作
- 错误日志：记录系统错误信息

**4.4.3 监控告警**
- 性能监控：监控系统性能指标
- 异常监控：监控系统异常
- 告警机制：关键异常及时告警

---

### 4.5 兼容性需求

**4.5.1 浏览器兼容性**
- PC Web端支持：Chrome、Edge、Firefox、Safari最新版本
- 支持响应式设计，兼容移动端浏览器

**4.5.2 租客端 / 员工端 H5 兼容性**
- 支持 **iOS Safari、Android Chrome/系统浏览器** 等主流移动浏览器（建议保持系统与浏览器为较新版本）
- **不做**微信小程序基础库版本约束
- 布局适配：窄屏竖屏为主，与 uni-app H5 响应式策略一致

**4.5.3 设备兼容性**
- 支持NFC功能的手机
- 支持高德地图API

---

### 4.6 用户体验需求

**4.6.1 界面设计**
- PC端：简洁现代风格，支持暗色模式
- 租客/员工 H5：简洁风格，与 PC 暗色主题协调

**4.6.2 交互设计**
- 操作流畅，响应及时
- 错误提示清晰明确
- 加载状态友好提示

**4.6.3 移动端优化**
- 适配不同屏幕尺寸
- 支持手势操作
- 优化网络请求

---

## 五、数据模型

### 5.1 核心数据表

**5.1.1 物业公司表 (companies)**
```typescript
{
  id: number;                    // 物业公司ID
  name: string;                  // 物业公司名称
  contact: string;               // 联系人
  phone: string;                 // 联系电话
  address: string;               // 地址
  status: string;                // 状态（启用/停用）
  appId: string;                 // 微信服务号AppID
  appSecret: string;             // 微信服务号AppSecret
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.2 物业员工表 (employees)**
```typescript
{
  id: number;                    // 员工ID
  companyId: number;             // 物业公司ID
  name: string;                  // 姓名
  phone: string;                 // 手机号（唯一）
  password: string;              // 密码（加密）
  projectId?: number;            // 所属项目ID
  departmentId?: number;         // 所属部门ID
  position: string;              // 岗位
  isLeader: boolean;             // 是否为组长
  businessTypes: string;         // 管理业务类型（JSON）
  roleId: number;                // 角色ID
  status: string;                // 状态
  lastLoginAt?: Date;            // 最后登录时间
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.3 租客表 (tenants)**
```typescript
{
  id: number;                    // 租客ID
  companyId: number;             // 物业公司ID
  type: string;                  // 类型（租客/业主）
  companyName: string;           // 公司名称
  moveInDate: Date;              // 入住日期
  leaseStartDate: Date;          // 租期开始日期
  leaseEndDate: Date;            // 租期结束日期
  buildingId: number;            // 所属楼宇ID
  totalArea: number;             // 租赁总面积
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.4 租客员工表 (tenant_users)**
```typescript
{
  id: number;                    // 员工ID
  companyId: number;             // 物业公司ID
  phone: string;                 // 手机号（唯一）
  password: string;              // 密码（加密）
  name: string;                  // 姓名
  isAdmin: boolean;              // 是否为租客管理员
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.5 租客员工-租客关联表 (tenant_user_relations)**
```typescript
{
  id: number;                    // 关联ID
  tenantUserId: number;          // 租客员工ID
  tenantId: number;              // 租客ID
  buildingId: number;            // 所属楼宇ID
  createdAt: Date;               // 创建时间
}
```

**5.1.6 租客-房源关联表 (tenant_room_relations)**
```typescript
{
  id: number;                    // 关联ID
  tenantId: number;              // 租客ID
  roomId: number;                // 房源ID
  leaseArea: number;             // 租赁面积
  createdAt: Date;               // 创建时间
}
```

**5.1.7 楼宇表 (buildings)**
```typescript
{
  id: number;                    // 楼宇ID
  companyId: number;             // 物业公司ID
  name: string;                  // 楼宇名称
  area: number;                  // 楼宇面积
  manager: string;               // 负责人
  phone: string;                 // 联系电话
  location: string;              // 位置（高德地图坐标）
  projectId?: number;            // 所属项目ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.8 楼层表 (floors)**
```typescript
{
  id: number;                    // 楼层ID
  buildingId: number;            // 所属楼宇ID
  name: string;                  // 楼层名称
  sort: number;                  // 排序
  area: number;                  // 楼层面积（自动计算）
  createdAt: Date;               // 创建时间
}
```

**5.1.9 房源表 (rooms)**
```typescript
{
  id: number;                    // 房源ID
  companyId: number;             // 物业公司ID
  buildingId: number;            // 所属楼宇ID
  floorId: number;               // 所属楼层ID
  name: string;                  // 房源名称
  roomNumber: string;            // 房号
  area: number;                  // 管理面积
  type: string;                  // 类型（商铺/写字楼/住宅）
  status: string;                // 状态（空置/已租/自用）
  leasingStatus: string;         // 招商状态（可招商/不可招商）
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.10 账单规则表 (bill_rules)**
```typescript
{
  id: number;                    // 规则ID
  companyId: number;             // 物业公司ID
  name: string;                  // 规则名称
  code: string;                  // 规则编号
  feeType: string;               // 费用类型
  amount: number;                // 应收金额
  discountRate: number;          // 折扣率
  discountAmount: number;        // 减免金额
  tenantIds: string;             // 适用租客ID列表（JSON）
  buildingIds: string;           // 适用楼宇ID列表（JSON）
  roomIds: string;               // 适用房源ID列表（JSON）
  periodStartDate: Date;         // 账期开始日期
  periodEndDate: Date;           // 账期结束日期
  accountId: number;             // 默认收款账户ID
  status: string;                // 状态
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.11 账单表 (bills)**
```typescript
{
  id: number;                    // 账单ID
  companyId: number;             // 物业公司ID
  code: string;                  // 账单编号
  ruleId: number;                // 规则ID
  ruleName: string;              // 规则名称
  projectId: number;             // 所属项目ID
  buildingId: number;            // 所属楼宇ID
  roomId: number;                // 所属房源ID
  tenantId: number;              // 所属租客ID
  feeType: string;               // 费用类型
  period: string;                // 账期
  accountReceivable: number;     // 应收金额
  amountPaid: number;            // 已缴纳金额
  amountDue: number;             // 需缴纳金额
  status: string;                // 账单状态
  paymentStatus: string;         // 结清状态
  dueDate: Date;                 // 应收日期
  accountId: number;             // 收款账户ID
  remark: string;                // 备注
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.12 缴纳记录表 (payments)**
```typescript
{
  id: number;                    // 记录ID
  companyId: number;             // 物业公司ID
  code: string;                  // 缴纳编号
  tenantId: number;              // 关联租客
  paidAt: Date;                  // 缴纳时间
  payer: string;                 // 缴纳人
  totalAmount: number;           // 缴纳总额
  paymentMethod: string;         // 支付方式
  paymentStatus: string;         // 支付状态
  transactionId?: string;        // 交易号
  operatorId: number;            // 操作人ID
  createdAt: Date;               // 创建时间
}
```

**5.1.13 缴纳-账单关联表 (payment_bill_relations)**
```typescript
{
  id: number;                    // 关联ID
  paymentId: number;             // 缴纳记录ID
  billId: number;                // 账单ID
  billCode: string;              // 账单编号
  amount: number;                // 本次缴纳金额
  amountDueBefore: number;       // 缴纳前需缴纳金额
  amountDueAfter: number;        // 缴纳后需缴纳金额
  createdAt: Date;               // 创建时间
}
```

**5.1.14 退费记录表 (refunds)**
```typescript
{
  id: number;                    // 退费ID
  companyId: number;             // 物业公司ID
  code: string;                  // 退费编号
  billId: number;                // 关联账单ID
  tenantId: number;              // 所属租客ID
  refundAt: Date;                // 退费时间
  refunder: string;              // 退费人
  operatorId: number;            // 操作人ID
  amount: number;                // 退费金额
  reason: string;                // 退费原因
  remark: string;                // 备注
  createdAt: Date;               // 创建时间
}
```

**5.1.15 催缴记录表 (payment_reminders)**
```typescript
{
  id: number;                    // 催缴ID
  companyId: number;             // 物业公司ID
  code: string;                  // 催缴编号
  billIds: string;               // 关联账单ID列表（JSON）
  method: string;                // 催缴方式
  content: string;               // 催缴内容
  notifyTargetId: number;        // 通知对象
  status: string;                // 催缴状态
  sentAt: Date;                  // 催缴时间
  operatorId: number;            // 催缴人ID
  createdAt: Date;               // 创建时间
}
```

**5.1.16 工单表 (work_orders)**
```typescript
{
  id: number;                    // 工单ID
  companyId: number;             // 物业公司ID
  code: string;                  // 工单编号
  projectId: number;             // 所属项目ID
  buildingId: number;            // 所属楼宇ID
  roomId: number;                // 所属房源ID
  tenantId: number;              // 所属租客ID
  reporterId: number;            // 提报人ID
  source: string;                // 工单来源
  type: string;                  // 工单类型
  title: string;                 // 问题标题
  description: string;           // 问题描述
  images: string;                // 问题图片（JSON）
  location: string;              // 位置信息
  severity?: string;             // 异常严重级别
  taskId?: number;               // 巡检任务ID
  tagId?: string;                // NFC标签ID
  status: string;                // 工单状态
  assignedAt?: Date;             // 派单时间
  assignedTo?: number;           // 被派单人ID
  assignedHistory: string;       // 派单历史（JSON）
  respondedAt?: Date;            // 响应时间
  completedAt?: Date;            // 完成时间
  evaluatedAt?: Date;            // 评价时间
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.17 工单处理记录表 (work_order_handles)**
```typescript
{
  id: number;                    // 处理ID
  workOrderId: number;           // 工单ID
  handlerId: number;             // 处理人ID
  content: string;               // 处理内容
  images: string;                // 处理图片（JSON）
  status: string;                // 处理状态
  handledAt: Date;               // 处理时间
  createdAt: Date;               // 创建时间
}
```

**5.1.18 工单评价表 (work_order_evaluations)**
```typescript
{
  id: number;                    // 评价ID
  workOrderId: number;           // 工单ID
  evaluatorId: number;           // 评价人ID
  rating: number;                // 评分（1-5星）
  content: string;               // 评价内容
  evaluatedAt: Date;             // 评价时间
  createdAt: Date;               // 创建时间
}
```

**5.1.19 巡检计划表 (inspection_plans)**
```typescript
{
  id: number;                    // 计划ID
  companyId: number;             // 物业公司ID
  name: string;                  // 计划名称
  inspectionType: string;        // 巡检类型
  cycleType: string;             // 周期类型
  cycleValue: number;            // 周期值
  userIds: string;               // 巡检人员ID列表（JSON）
  route: string;                 // 巡检路线（JSON）
  checkItems: string;            // 检查项目列表（JSON）
  status: string;                // 状态
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.20 巡检任务表 (inspection_tasks)**
```typescript
{
  id: number;                    // 任务ID
  companyId: number;             // 物业公司ID
  code: string;                  // 任务编号
  planId: number;                // 所属计划ID
  planName: string;              // 计划名称
  inspectionType: string;        // 巡检类型
  scheduledDate: Date;           // 计划巡检日期
  userIds: string;               // 巡检人员ID列表（JSON）
  route: string;                 // 巡检路线（JSON）
  checkItems: string;            // 检查项目列表（JSON）
  status: string;                // 任务状态
  startedAt?: Date;              // 开始时间
  completedAt?: Date;            // 完成时间
  completedBy?: number;          // 完成人ID
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.21 巡检记录表 (inspection_records)**
```typescript
{
  id: number;                    // 记录ID
  companyId: number;             // 物业公司ID
  taskId: number;                // 巡检任务ID
  taskCode: string;              // 任务编号
  inspectionType: string;        // 巡检类型
  tagId: string;                 // NFC标签ID
  location: string;              // 位置名称
  checkedAt: Date;               // 检查时间
  checkedBy: number;             // 检查人ID
  status: string;                // 巡检状态
  checkItems: string;            // 检查项目列表（JSON）
  createdAt: Date;               // 创建时间
}
```

**5.1.22 NFC标签表 (nfc_tags)**
```typescript
{
  id: number;                    // 标签ID
  companyId: number;             // 物业公司ID
  tagId: string;                 // NFCID（唯一）
  location: string;              // 具体位置
  description: string;           // 说明
  inspectionType: string;        // 巡检类型
  buildingId: number;            // 所属楼宇
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.23 公告表 (announcements)**
```typescript
{
  id: number;                    // 公告ID
  companyId: number;             // 物业公司ID
  title: string;                 // 公告标题
  content: string;               // 公告内容（富文本）
  images: string;                // 附件图片URL列表（JSON）
  scope: string;                 // 发布范围
  buildingIds: string;           // 指定楼宇ID列表（JSON）
  publishTime?: Date;            // 发布时间
  status: string;                // 状态
  readCount: number;             // 阅读人数
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.24 卫生吐槽表 (complaints)**
```typescript
{
  id: number;                    // 吐槽ID
  companyId: number;             // 物业公司ID
  projectId: number;             // 所属项目ID
  buildingId: number;            // 所属楼宇ID
  tenantId: number;              // 所属租客ID
  reporterId: number;            // 提报人ID
  location: string;              // 位置描述
  description: string;           // 问题描述
  images: string;                // 问题图片（JSON）
  status: string;                // 处理状态
  assignedAt?: Date;             // 分配时间
  assignedTo?: number;           // 分配给
  handledBy?: number;            // 处理人ID
  handledAt?: Date;              // 处理时间
  result: string;                // 处理结果
  resultImages: string;          // 处理图片（JSON）
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.25 设备表 (devices)**
```typescript
{
  id: number;                    // 设备ID
  companyId: number;             // 物业公司ID
  code: string;                  // 设备编号
  name: string;                  // 设备名称
  type: string;                  // 设备类型
  location: string;              // 所在位置
  buildingId: number;            // 所属楼宇ID
  commissionedDate: Date;        // 投入使用日期
  supplier: string;              // 供应商
  contactPhone: string;          // 联系电话
  tagId?: string;                // NFC标签ID
  status: string;                // 设备状态
  createdAt: Date;               // 创建时间
  updatedAt: Date;               // 更新时间
}
```

**5.1.26 设备维保记录表 (device_maintenances)**
```typescript
{
  id: number;                    // 维保ID
  companyId: number;             // 物业公司ID
  deviceId: number;              // 设备ID
  code: string;                  // 维保编号
  type: string;                  // 维保类型
  date: Date;                    // 维保日期
  maintainerId: number;          // 维保人员ID
  cost: number;                  // 费用
  content: string;               // 维保内容
  images: string;                // 维保图片（JSON）
  remark: string;                // 备注
  createdAt: Date;               // 创建时间
}
```

---

## 六、接口设计

### 6.1 认证接口

**6.1.1 用户登录**
```
POST /api/auth/login
Request Body: {
  phone: string;
  password: string;
  userType: string;              // employee | tenant_user
}
Response: {
  token: string;
  user: {
    id: number;
    name: string;
    phone: string;
    userType: string;
    companyId: number;
    // ...其他用户信息
  }
}
```

**6.1.2 修改密码**
```
POST /api/auth/change-password
Request Body: {
  oldPassword: string;
  newPassword: string;
}
Response: {
  success: boolean;
  message: string;
}
```

---

### 6.2 基础信息接口

**6.2.1 获取楼宇列表**
```
GET /api/buildings
Query Params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}
Response: {
  list: Building[];
  total: number;
}
```

**6.2.2 创建楼宇**
```
POST /api/buildings
Request Body: {
  name: string;
  area: number;
  manager: string;
  phone: string;
  location: string;
}
Response: {
  id: number;
  success: boolean;
  message: string;
}
```

**6.2.3 获取房源列表**
```
GET /api/rooms
Query Params: {
  page?: number;
  pageSize?: number;
  buildingId?: number;
  status?: string;
}
Response: {
  list: Room[];
  total: number;
}
```

---

### 6.3 租客管理接口

**6.3.1 获取租客列表**
```
GET /api/tenants
Query Params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
}
Response: {
  list: Tenant[];
  total: number;
}
```

**6.3.2 创建租客**
```
POST /api/tenants
Request Body: {
  type: string;
  companyName: string;
  moveInDate: Date;
  leaseStartDate: Date;
  leaseEndDate: Date;
  buildingId: number;
  roomIds: number[];
}
Response: {
  id: number;
  success: boolean;
  message: string;
}
```

---

### 6.4 账单管理接口

**6.4.1 获取账单列表**
```
GET /api/bills
Query Params: {
  page?: number;
  pageSize?: number;
  tenantId?: number;
  status?: string;
  paymentStatus?: string;
}
Response: {
  list: Bill[];
  total: number;
}
```

**6.4.2 生成账单**
```
POST /api/bills
Request Body: {
  ruleId: number;
  tenantId: number;
  roomIds: number[];
  dueDate: Date;
  remark?: string;
}
Response: {
  id: number;
  success: boolean;
  message: string;
}
```

**6.4.3 缴纳账单**
```
POST /api/payments
Request Body: {
  tenantId: number;
  billIds: number[];             // 可多个账单
  totalAmount: number;
  paymentMethod: string;
  // 系统自动按账单时间顺序分配金额
}
Response: {
  id: number;
  code: string;
  allocations: Array<{           // 分配明细
    billId: number;
    billCode: string;
    amount: number;
    amountDueBefore: number;
    amountDueAfter: number;
  }>;
  success: boolean;
  message: string;
}
```

**6.4.4 创建退费**
```
POST /api/refunds
Request Body: {
  billId: number;
  amount: number;
  reason: string;
  remark?: string;
}
Response: {
  id: number;
  code: string;
  success: boolean;
  message: string;
}
```

**6.4.5 发送催缴通知**
```
POST /api/payment-reminders
Request Body: {
  billIds: number[];
  method: string;                // notification | print
  templateId?: number;           // 打印模板ID
}
Response: {
  id: number;
  success: boolean;
  message: string;
}
```

---

### 6.5 工单管理接口

**移动端门户（租客 / 员工 H5）说明**  
租客与员工 H5 创建、列表、详情、改派、推进、确认费用等，统一走 **`/api/mp/work-orders`** 及子路径（如 `GET/PUT /api/mp/work-orders/{id}`、`POST .../advance`、`POST .../assign`、`POST .../confirm-fee`），与 PC 的 `/api/work-orders/*` 并存；鉴权 **Bearer**（及同域 Cookie）。工单图片上传见 **`POST /api/work-orders/upload-image`**（与 PC 共用）。

**6.5.1 获取工单列表（PC 管理端）**
```
GET /api/work-orders
Query Params: {
  page?: number;
  pageSize?: number;
  status?: string;
  type?: string;
  handlerId?: number;
  startDate?: Date;
  endDate?: Date;
}
Response: {
  list: {
    待派单: WorkOrder[];
    待响应: WorkOrder[];
    处理中: WorkOrder[];
    待评价: WorkOrder[];
    评价完成: WorkOrder[];
    已取消: WorkOrder[];
  };
}
```

**6.5.2 创建工单（租客端 H5）**
```
POST /api/mp/work-orders
Request Body: {
  category: string;              // 报事 | 报修
  facilityScope: string;         // 公共设施 | 套内设施
  title: string;
  description: string;
  location?: string;
  feeNoticeAcknowledged?: boolean;  // 套内设施时须为 true
  images?: string[];            // 上传后的相对 URL 列表，最多 10 张
}
Response: {
  success: boolean;
  message?: string;
  code?: string;                 // 工单编号等业务字段以实际接口为准
}
```

**6.5.3 派单**
```
POST /api/work-orders/:id/assign
Request Body: {
  assignedTo: number;
  reason?: string;               // 重新派单原因
}
Response: {
  success: boolean;
  message: string;
}
```

**6.5.4 处理工单**
```
POST /api/work-orders/:id/handle
Request Body: {
  content: string;
  images: string[];
  status: string;                // 处理中 | 已完成
}
Response: {
  success: boolean;
  message: string;
}
```

**6.5.5 评价工单**
```
POST /api/work-orders/:id/evaluate
Request Body: {
  rating: number;
  content: string;
}
Response: {
  success: boolean;
  message: string;
}
```

---

### 6.6 巡检管理接口

**6.6.1 获取巡检任务列表**
```
GET /api/inspection-tasks
Query Params: {
  page?: number;
  pageSize?: number;
  status?: string;
  inspectionType?: string;
  userId?: number;                // 查看我的任务
}
Response: {
  list: InspectionTask[];
  total: number;
}
```

**6.6.2 开始巡检**
```
POST /api/inspection-tasks/:id/start
Response: {
  success: boolean;
  message: string;
}
```

**6.6.3 NFC感应检查点**
```
POST /api/inspection-tasks/:id/check-point
Request Body: {
  tagId: string;
  checkItems: Array<{
    itemName: string;
    result: string;              // normal | abnormal
    severity?: string;
    description?: string;
    images?: string[];
  }>;
}
Response: {
  success: boolean;
  message: string;
  autoCompleted: boolean;        // 是否自动完成巡检
}
```

**6.6.4 完成巡检**
```
POST /api/inspection-tasks/:id/complete
Response: {
  success: boolean;
  message: string;
}
```

---

### 6.7 消息推送接口

**6.7.1 发送服务号消息**
```
POST /api/messages/send-service-message
Request Body: {
  userIds: number[];
  messageType: string;           // work_order | inspection | bill | announcement
  data: object;                  // 消息数据
}
Response: {
  success: boolean;
  message: string;
}
```

**6.7.2 获取消息列表**
```
GET /api/messages
Query Params: {
  page?: number;
  pageSize?: number;
  type?: string;
}
Response: {
  list: Message[];
  total: number;
}
```

---

## 七、附录

### 7.1 术语表

| 术语 | 解释 |
|------|------|
| 物业公司 | 使用本系统的物业管理企业 |
| 租客 | 租赁商铺、写字楼或自用的企业或个人 |
| 租客员工 | 租客企业下的员工，使用 **租客端 H5** |
| 租客管理员 | 租客员工中具有管理员权限的员工 |
| 物业员工 | 物业公司的工作人员，使用 **员工端 H5**（或 PC 管理端，视岗位而定） |
| 组长 | 物业员工中负责派单的人员 |
| 账单 | 向租客收取费用的单据 |
| 工单 | 报事报修或巡检异常生成的工作单据 |
| 巡检 | 定期检查物业设施设备的工作 |
| NFC | 近场通信技术，用于巡检打卡 |

---

### 7.2 技术规范

**7.2.1 代码规范**
- 使用TypeScript类型系统
- 遵循ESLint代码规范
- 函数命名使用驼峰命名法
- 常量命名使用大写下划线命名法

**7.2.2 接口规范**
- RESTful API设计
- 统一返回格式：
```typescript
{
  code: number;                  // 状态码
  message: string;               // 消息
  data: any;                     // 数据
}
```
- 统一错误码：
  - 200: 成功
  - 400: 请求参数错误
  - 401: 未授权
  - 403: 无权限
  - 404: 资源不存在
  - 500: 服务器错误

**7.2.3 数据库规范**
- 表名使用小写下划线命名法
- 字段名使用小写下划线命名法
- 主键统一使用id
- 外键统一使用xxxId
- 创建时间统一使用createdAt
- 更新时间统一使用updatedAt
- 软删除使用deletedAt

---

### 7.3 部署规范

**7.3.1 环境配置**
- 开发环境：dev
- 测试环境：test
- 生产环境：prod

**7.3.2 端口配置**
- PC Web 端 / Next API：**5001**（开发时建议使用 `--hostname 0.0.0.0` 以便局域网 H5 访问）
- 租客 / 员工 uni-app **H5 开发**：Vite 默认 **5173**，通过代理或环境变量将 `/api`、`/uploads` 指向 5001
- 数据库：3306（MySQL）或 SQLite（本地）
- Redis：6379（若启用）

**7.3.3 文件存储**
- 文件存储在本地服务器
- 文件路径：/workspace/projects/public/uploads/
- 图片限制：单张不超过10MB
- 支持格式：jpeg、png、jpg

---

### 7.4 安全规范

**7.4.1 密码安全**
- 密码使用bcrypt加密
- 密码长度至少6位
- 修改密码需要验证原密码

**7.4.2 接口安全**
- 所有接口需要JWT Token认证
- 敏感操作需要二次验证
- 接口频率限制：每分钟最多100次请求

**7.4.3 数据安全**
- 不同物业公司数据完全隔离
- 敏感数据加密存储
- 定期数据备份

---

### 7.5 变更记录

| 版本 | 日期 | 变更内容 | 变更人 |
|------|------|----------|--------|
| v1.0.0 | 2025-01-XX | 初始版本 | 系统 |
| v1.2.0 | 2025-03-24 | **租客端、员工端明确为仅 H5（uni-app），不再交付微信小程序**；PRD 中架构、兼容性、术语与工单/接口描述同步；补充 `/api/mp` 为移动端门户路径名、CORS 与图片上传、报修提交后跳转列表、PC/ H5 部分交互（操作日志时间轴、查看电话等）与文档头部开发进度对齐 | 系统 |

---

## 结语

本文档为商业写字楼物业管理系统的完整产品需求文档，涵盖了系统的所有功能需求、非功能需求、数据模型和接口设计。在开发过程中，如有需求变更，请及时更新本文档，并记录变更历史。

---

**文档结束**
