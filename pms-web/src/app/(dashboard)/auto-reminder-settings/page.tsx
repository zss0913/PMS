import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AutoReminderSettingForm } from '@/components/auto-reminder-settings/AutoReminderSettingForm'

export default async function AutoReminderSettingsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">自动催缴设置</h1>
      <AutoReminderSettingForm isSuperAdmin={user.companyId === 0} />
    </div>
  )
}
