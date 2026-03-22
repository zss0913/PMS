import { redirect } from 'next/navigation'

/** 已合并至「消息通知」，保留路径避免旧链接失效 */
export default function TenantAnnouncementsRedirectPage() {
  redirect('/m/tenant/messages')
}
