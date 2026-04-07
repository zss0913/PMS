import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('123456', 10)

  let superAdmin = await prisma.superAdmin.findFirst()
  if (!superAdmin) {
    superAdmin = await prisma.superAdmin.create({
      data: {
        name: '超级管理员',
        phone: '13800138000',
        password: hashedPassword,
      },
    })
    console.log('SuperAdmin created:', superAdmin.phone)
  }

  let company = await prisma.company.findFirst()
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: '康华物业',
        contact: '张经理',
        phone: '13800138001',
        address: '测试地址',
        status: 'active',
      },
    })
    console.log('Company created:', company.name)
  }

  let role = await prisma.role.findFirst({ where: { companyId: company.id } })
  if (!role) {
    role = await prisma.role.create({
      data: {
        name: '系统管理员',
        code: 'admin',
        dataScope: 'all',
        companyId: company.id,
      },
    })
  }

  let dept = await prisma.department.findFirst({ where: { companyId: company.id } })
  if (!dept) {
    dept = await prisma.department.create({
      data: {
        name: '综合管理部',
        companyId: company.id,
      },
    })
  }

  let employee = await prisma.employee.findFirst({
    where: { phone: '13800138002' },
  })
  if (!employee) {
    employee = await prisma.employee.create({
      data: {
        name: '物业管理员',
        phone: '13800138002',
        password: hashedPassword,
        position: '管理员',
        isLeader: true,
        businessTypes: '["报修","巡检","设备"]',
        roleId: role.id,
        departmentId: dept.id,
        companyId: company.id,
        status: 'active',
      },
    })
    console.log('Employee created: 13800138002 / 密码: 123456')
  }

  let account = await prisma.account.findFirst({ where: { companyId: company.id } })
  if (!account) {
    account = await prisma.account.create({
      data: {
        name: '公司主账户',
        bankName: '中国银行测试支行',
        accountNumber: '6217000012345678901',
        companyId: company.id,
      },
    })
  }

  let project = await prisma.project.findFirst({ where: { companyId: company.id } })
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: '康华大厦',
        location: '116.397428,39.90923',
        area: 10000,
        greenArea: 2000,
        manager: '李经理',
        phone: '13800138003',
        companyId: company.id,
      },
    })
  }

  let building = await prisma.building.findFirst({ where: { companyId: company.id } })
  if (!building) {
    building = await prisma.building.create({
      data: {
        name: 'A座',
        area: 5000,
        manager: '王主任',
        phone: '13800138004',
        projectId: project.id,
        companyId: company.id,
      },
    })
  }

  let floor = await prisma.floor.findFirst({ where: { buildingId: building.id } })
  if (!floor) {
    floor = await prisma.floor.create({
      data: {
        buildingId: building.id,
        name: '1楼',
        sort: 1,
        area: 500,
      },
    })
  }

  let room = await prisma.room.findFirst({ where: { companyId: company.id } })
  if (!room) {
    room = await prisma.room.create({
      data: {
        name: '101室',
        roomNumber: '101',
        area: 100,
        buildingId: building.id,
        floorId: floor.id,
        type: '写字楼',
        status: '已租',
        leasingStatus: '不可招商',
        companyId: company.id,
      },
    })
  }

  let tenant = await prisma.tenant.findFirst({ where: { companyId: company.id } })
  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: {
        type: '租客',
        companyName: '测试科技公司',
        moveInDate: new Date(),
        leaseStartDate: new Date(),
        leaseEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        buildingId: building.id,
        totalArea: 100,
        companyId: company.id,
      },
    })

    await prisma.tenantRoom.create({
      data: {
        tenantId: tenant.id,
        roomId: room.id,
        leaseArea: 100,
      },
    })
  }

  let tenantUser = await prisma.tenantUser.findFirst({ where: { companyId: company.id } })
  if (!tenantUser) {
    tenantUser = await prisma.tenantUser.create({
      data: {
        phone: '13800138010',
        password: hashedPassword,
        name: '租客用户',
        companyId: company.id,
        status: 'active',
      },
    })
    await prisma.tenantUserRelation.create({
      data: {
        tenantUserId: tenantUser.id,
        tenantId: tenant.id,
        buildingId: building.id,
        isAdmin: true,
      },
    })
    console.log('TenantUser created: 13800138010 / 密码: 123456')
  }

  let workOrderType = await prisma.workOrderType.findFirst({ where: { companyId: company.id } })
  if (!workOrderType) {
    workOrderType = await prisma.workOrderType.create({
      data: {
        name: '报修',
        sort: 0,
        enabled: true,
        companyId: company.id,
      },
    })
    await prisma.workOrderType.create({
      data: {
        name: '投诉',
        sort: 1,
        enabled: true,
        companyId: company.id,
      },
    })
    await prisma.workOrderType.create({
      data: {
        name: '报事',
        sort: 2,
        enabled: true,
        companyId: company.id,
      },
    })
  }

  const workOrderCount = await prisma.workOrder.count({ where: { companyId: company.id } })
  if (workOrderCount === 0) {
    await prisma.workOrder.create({
      data: {
        code: 'WO' + Date.now().toString(36).toUpperCase(),
        buildingId: building.id,
        roomId: room.id,
        tenantId: tenant.id,
        reporterId: employee.id,
        source: 'PC自建',
        type: '报修',
        title: '测试工单-空调不制冷',
        description: '101室空调不制冷，需要维修',
        status: '待派单',
        companyId: company.id,
      },
    })
  }

  let inspectionPlan = await prisma.inspectionPlan.findFirst({ where: { companyId: company.id } })
  if (!inspectionPlan) {
    inspectionPlan = await prisma.inspectionPlan.create({
      data: {
        name: '每日工程巡检',
        inspectionType: '工程',
        cycleType: '每天',
        cycleValue: 1,
        cycleSchedule: JSON.stringify({ v: 1, kind: 'daily', slots: [{ time: '09:00' }] }),
        requirePhoto: true,
        buildingId: building.id,
        userIds: JSON.stringify([employee.id]),
        checkItems: JSON.stringify([]),
        status: 'active',
        companyId: company.id,
      },
    })
  }

  const taskCount = await prisma.inspectionTask.count({ where: { companyId: company.id } })
  const planItemsRaw = inspectionPlan.checkItems?.trim()
  if (taskCount === 0 && planItemsRaw && planItemsRaw !== '[]' && planItemsRaw !== 'null') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    await prisma.inspectionTask.create({
      data: {
        code: 'IT' + Date.now().toString(36).toUpperCase(),
        planId: inspectionPlan.id,
        planName: inspectionPlan.name,
        inspectionType: inspectionPlan.inspectionType,
        scheduledDate: today,
        requirePhoto: inspectionPlan.requirePhoto,
        userIds: inspectionPlan.userIds,
        checkItems: inspectionPlan.checkItems,
        buildingId: inspectionPlan.buildingId,
        status: '待执行',
        companyId: company.id,
      },
    })
  }

  /** 租客小程序 /api/mp/announcements 仅展示已发布；仅有草稿时列表仍为空，故按「已发布条数」补种 */
  const publishedAnnouncementCount = await prisma.announcement.count({
    where: {
      companyId: company.id,
      status: { in: ['published', '已发布'] },
    },
  })
  if (publishedAnnouncementCount === 0) {
    const pub = await prisma.employee.findFirst({ where: { companyId: company.id } })
    const publisherName = pub?.name ?? '物业管理处'
    const publisherId = pub?.id ?? null
    await prisma.announcement.createMany({
      data: [
        {
          title: '关于大厦消防演练的通知',
          content:
            '<p>定于本周五 15:00 进行消防疏散演练，请各租户配合现场指引。</p>',
          images: null,
          scope: 'all',
          buildingIds: null,
          publishTime: new Date(),
          status: 'published',
          readCount: 0,
          companyId: company.id,
          publisherName,
          publisherId,
        },
        {
          title: 'A座电梯维保暂停使用说明',
          content: '<p>A座客梯将于周六上午例行维保，请优先使用货梯出入。</p>',
          images: null,
          scope: 'specified',
          buildingIds: JSON.stringify([building.id]),
          publishTime: new Date(),
          status: '已发布',
          readCount: 0,
          companyId: company.id,
          publisherName,
          publisherId,
        },
      ],
    })
    console.log('Announcements seeded (小程序公告列表可见)')
  }

  console.log('Seed completed!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
