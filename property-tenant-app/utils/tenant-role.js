/** 当前登录用户是否为「租户管理员」（任一关联关系 isAdmin） */
export function isTenantAdmin(user) {
  if (!user || !Array.isArray(user.relations)) return false
  return user.relations.some((r) => r && r.isAdmin === true)
}
