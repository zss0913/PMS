import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProjectList } from '@/components/projects/ProjectList'

export default async function ProjectsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const isSuperAdmin = user.companyId === 0
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">项目管理</h1>
      <ProjectList isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
