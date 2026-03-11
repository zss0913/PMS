import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

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

  console.log('Seed completed!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
