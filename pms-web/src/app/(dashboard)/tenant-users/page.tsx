import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { TenantUserAccountList } from '@/components/tenant-users/TenantUserAccountList'

export default async function TenantUsersPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  if (user.companyId === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">租客账号</h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-6 text-amber-800 dark:text-amber-200">
          <p className="font-medium">超级管理员账号无法管理租客账号</p>
          <p className="text-sm mt-1">请使用物业公司员工账号登录后操作。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">租客账号</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        展示当前物业公司下全部租客绑定的租客端账号。同一手机号可在不同租客下有多条记录。默认按绑定创建时间倒序，支持筛选与分页。
      </p>
      <TenantUserAccountList />
    </div>
  )
}
