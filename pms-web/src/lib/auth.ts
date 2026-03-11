import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'pms-dev-secret-key-2025'
)

export type AuthUser = {
  id: number
  phone: string
  name: string
  companyId: number
  type: 'super_admin' | 'employee'
  roleId?: number
}

export async function createToken(user: AuthUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    phone: user.phone,
    name: user.name,
    companyId: user.companyId,
    type: user.type,
    roleId: user.roleId,
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
  return verifyToken(token)
}
