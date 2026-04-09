import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PlatformMpSettingsForm } from '@/components/platform-mp-settings/PlatformMpSettingsForm'

export default async function PlatformMpSettingsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  if (user.type !== 'super_admin') redirect('/')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">全局小程序配置</h1>
      <PlatformMpSettingsForm />
    </div>
  )
}
