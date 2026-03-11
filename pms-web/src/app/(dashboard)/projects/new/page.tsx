import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProjectForm } from '@/components/projects/ProjectForm'

export default async function NewProjectPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/projects')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">新增项目</h1>
      <ProjectForm mode="new" />
    </div>
  )
}
