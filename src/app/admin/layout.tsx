// D26 9-1절 — 관리자 셸.
//
// D9 이후 관리자 지시서를 만들지 않아 화면 6개가 뒤로가기 링크로만 이어져 있었다.
// 그 상태에서는 관리자가 지금 무엇이 밀려 있는지 어느 화면에서도 알 수 없다.
// 셸이 먼저 서야 나머지 화면을 여기에 건다.
//
// ⚠️ 간격은 14px 하나다. 20·18·16 을 섞지 않는다(CLAUDE.md 고정 규칙).
// ⚠️ 배지 숫자는 getTodayQueue() 한 곳에서만 센다 — 화면마다 따로 세면 어긋난다.

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import LogoutButton from '@/components/LogoutButton'
import AdminSidebar from '@/components/admin/AdminSidebar'
import { getTodayQueue } from '@/lib/admin/todayQueue'
import { BATCH_ROUTES } from '@/lib/admin/batchRoutes'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/login')

  const queue = await getTodayQueue()
  const name = profile?.name ?? '운영'
  const initial = (name.trim().split(/\s+/).pop() ?? name)[0] ?? '운'

  const cronOk = queue.unregistered.length === 0

  return (
    <div className="min-w-[1360px] flex bg-[#F4F4F6] min-h-screen">
      <aside className="w-[236px] shrink-0 bg-white border-r border-[#EAEAEE] sticky top-0 h-screen flex flex-col">
        <Link
          href="/admin/dashboard"
          className="h-16 flex items-center gap-[10px] px-5 border-b border-[#F1F1F4]"
          title="오늘로"
        >
          <svg viewBox="0 0 64 64" width="24" height="24" className="shrink-0">
            <rect width="64" height="64" rx="16.6" fill="#17171B" />
            <rect y="37.1" width="64" height="1.9" fill="#fff" opacity="0.28" />
            <rect x="24.3" width="1.9" height="64" fill="#fff" opacity="0.28" />
            <circle cx="25.3" cy="38.1" r="8.3" fill="#F59E0B" />
          </svg>
          <div className="min-w-0">
            <div className="flex items-center text-[14px] font-black tracking-[0.05em] leading-none text-[#17171B]">
              MATCH
              <span className="w-1 h-1 rounded-full bg-[#F59E0B] mx-[3px] shrink-0" />
              POST
            </div>
            <div className="text-[10px] font-bold text-[#B0B0BB] mt-[3px]">운영 콘솔</div>
          </div>
        </Link>

        <div className="px-3 pt-[10px] flex-1 min-h-0 overflow-y-auto">
          <AdminSidebar
            counts={{
              reports: queue.openReports,
              settle: queue.overdue,
              members: queue.bizPending,
              system: queue.unregistered.length,
            }}
          />
        </div>

        {/* 사이드바 바닥 — 지금 시스템이 성한지. 어느 화면에 있든 보인다 */}
        <div className="px-[14px] py-3 border-t border-[#F1F1F4]">
          <div className="bg-[#FBFBFC] border border-[#EFEFF2] rounded-[11px] px-3 py-[11px]">
            <div className="flex items-center gap-[6px]">
              <span
                className={`w-[7px] h-[7px] rounded-full shrink-0 ${cronOk ? 'bg-[#22C55E]' : 'bg-[#EF4444]'}`}
              />
              <span className="text-[11.5px] font-bold text-[#3C3C46]">
                {cronOk ? '자동 처리 정상' : `크론 미등록 ${queue.unregistered.length}건`}
              </span>
            </div>
            <div className="text-[10.5px] text-[#9A9AA5] leading-[1.55] mt-[5px]">
              {cronOk
                ? `자동 처리 ${BATCH_ROUTES.length}개가 모두 등록돼 있어요.`
                : '코드에는 있는데 아무도 부르지 않는 자동 처리가 있어요.'}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 shrink-0 bg-white border-b border-[#EAEAEE] flex items-center px-7 sticky top-0 z-20">
          <span className="text-[14px] font-extrabold tracking-[-0.02em] text-[#17171B]">
            운영 콘솔
          </span>
          <div className="ml-auto flex items-center gap-[9px]">
            <div className="flex items-center gap-[9px] h-[42px] pl-3 pr-[10px] rounded-[21px]">
              <span className="text-[12.5px] font-bold text-[#3C3C46]">{name}</span>
              <span className="w-[34px] h-[34px] rounded-full bg-[#17171B] text-white text-[13px] font-extrabold flex items-center justify-center">
                {initial}
              </span>
            </div>
            <LogoutButton />
          </div>
        </header>

        <main className="pt-5 px-7 pb-10 flex flex-col gap-[14px]">{children}</main>
      </div>
    </div>
  )
}
