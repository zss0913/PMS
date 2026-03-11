import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ProjectForm } from '@/components/projects/ProjectForm'

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.companyId === 0) redirect('/projects')
  const { id } = await params
  const projectId = parseInt(id, 10)
  if (isNaN(projectId)) redirect('/projects')
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">编辑项目</h1>
      <ProjectForm mode="edit" id={projectId} />
    </div>
  )
}
