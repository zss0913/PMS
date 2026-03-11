import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CompanyForm } from '@/components/companies/CompanyForm'

export default async function NewCompanyPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.type !== 'super_admin') redirect('/')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">新建物业公司</h1>
      <CompanyForm mode="new" />
    </div>
  )
}
