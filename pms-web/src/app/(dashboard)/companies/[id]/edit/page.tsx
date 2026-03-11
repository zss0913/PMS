import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CompanyForm } from '@/components/companies/CompanyForm'

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.type !== 'super_admin') redirect('/')
  const { id } = await params
  const companyId = parseInt(id, 10)
  if (isNaN(companyId)) redirect('/companies')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">编辑物业公司</h1>
      <CompanyForm mode="edit" id={companyId} />
    </div>
  )
}
