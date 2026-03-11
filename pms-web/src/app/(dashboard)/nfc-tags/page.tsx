import { getAuthUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NfcTagList } from '@/components/nfc-tags/NfcTagList'

export default async function NfcTagsPage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')
  const isSuperAdmin = user.companyId === 0

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">NFC标签</h1>
      <NfcTagList isSuperAdmin={isSuperAdmin} />
    </div>
  )
}
