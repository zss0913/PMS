import { TenantMainShell } from '@/components/m/TenantMainShell'

export default function TenantMainLayout({ children }: { children: React.ReactNode }) {
  return <TenantMainShell>{children}</TenantMainShell>
}
