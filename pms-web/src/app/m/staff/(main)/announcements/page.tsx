import { redirect } from 'next/navigation'

/** 公告已并入底部「消息通知」 */
export default function StaffAnnouncementsRedirectPage() {
  redirect('/m/staff/messages')
}
