import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pms-dev-secret-key-2025'
)

export type AuthUser = {
  id: number
  phone: string
  name: string
  companyId: number
  type: 'super_admin' | 'employee' | 'tenant'
  roleId?: number
  /** 员工项目ID，用于数据权限(本项目) */
  projectId?: number | null
  /** 员工部门ID，用于数据权限(本部门) */
  departmentId?: number | null
  /** 角色数据权限: all | project | department | self */
  dataScope?: string
  /** 是否组长，用于待派工单可见 */
  isLeader?: boolean
  /** 租客关联列表 tenantId, buildingId, isAdmin */
  relations?: { tenantId: number; buildingId: number; isAdmin: boolean }[]
}

export async function createToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    phone: user.phone,
    name: user.name,
    companyId: user.companyId,
    type: user.type,
    roleId: user.roleId,
    projectId: user.projectId ?? null,
    departmentId: user.departmentId ?? null,
    dataScope: user.dataScope ?? 'all',
    isLeader: user.isLeader ?? false,
    relations: user.relations ?? null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .setIssuedAt()
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<AuthUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as AuthUser
  } catch {
    return null
  }
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('pms_token')?.value
  if (!token) return null
  const user = await verifyToken(token)
  if (!user) return null

  // 从数据库同步最新姓名，确保员工账号修改姓名后侧边栏能及时更新
  if (user.type === 'employee') {
    const employee = await prisma.employee.findUnique({
      where: { id: user.id },
      select: { name: true },
    })
    if (employee) {
      user.name = employee.name
    }
  } else if (user.type === 'super_admin') {
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: user.id },
      select: { name: true },
    })
    if (superAdmin) {
      user.name = superAdmin.name
    }
  }

  return user
}

/** 小程序 / H5：Bearer token；H5 同域还可带 Cookie（pms_token） */
export async function getMpAuthUser(request: Request): Promise<AuthUser | null> {
  const auth = request.headers.get('Authorization')
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null
  if (bearer) {
    const u = await verifyToken(bearer)
    if (u) return u
  }
  const cookieStore = await cookies()
  const c = cookieStore.get('pms_token')?.value
  if (c) return verifyToken(c)
  return null
}

/**
 * API 路由：优先 Bearer（小程序），否则读 Cookie（H5 与 PC 共用 pms_token）
 */
export async function getRequestAuthUser(request: NextRequest): Promise<AuthUser | null> {
  const auth = request.headers.get('Authorization')
  if (auth?.startsWith('Bearer ')) {
    const u = await verifyToken(auth.slice(7))
    if (u) return u
  }
  return getAuthUser()
}
