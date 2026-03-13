import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PrintTemplateList } from '@/components/print-templates/PrintTemplateList'

export default async function PrintTemplatesPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">催缴打印模板管理</h1>
      <PrintTemplateList isSuperAdmin={user.companyId === 0} />
    </div>
  )
}
