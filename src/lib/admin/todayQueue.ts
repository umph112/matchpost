// D26 9-3절 — 「오늘」의 처리 대기 큐. 사이드바 배지도 같은 값을 쓴다.
//
// ⚠️ 프로토타입 주석 — 「모든 숫자는 이 배열에서 파생시킨다. 하드코딩 금지」.
//    화면마다 따로 세면 사이드바 배지와 카드 숫자가 어긋난다. 그래서 한 곳에서만 센다.
//
// ⚠️ 미수 판정은 settlementDateOf() 를 지난다(D20 §2-1). 인플루언서 정산 화면과 규칙이
//    한 글자라도 달라지면 "관리자 화면에는 5건인데 내 화면엔 4건"이 된다.

import { createServiceClient } from '@/lib/supabase/service'
import { createClient } from '@/lib/supabase/server'
import { settlementDateOf } from '@/lib/deals/settlementDate'
import { kstDateString } from '@/lib/date'
import { unregisteredBatches, type BatchRoute } from '@/lib/admin/batchRoutes'

export type OverdueRow = {
  proposalId: string
  campaignTitle: string
  settlementDate: string
  budget: number | null
}

export type TodayQueue = {
  /** 미입금 유형으로 접수돼 아직 열려 있는 신고 */
  unpaidReports: number
  /** 유형과 무관하게 열려 있는 신고 — 사이드바 「신고 접수」 배지 */
  openReports: number
  /** 서류를 올렸고 아직 승인·반려되지 않은 계정. 승인/반려 시 biz_doc_url 을 지우므로 not null = 대기 */
  bizPending: number
  /** 예정일이 지났는데 정산 기록이 없는 건 */
  overdue: number
  overdueRows: OverdueRow[]
  /** 코드에는 있는데 크론에 등록되지 않은 배치 */
  unregistered: BatchRoute[]
}

export async function getTodayQueue(): Promise<TodayQueue> {
  const db = createServiceClient()

  // 신고만 로그인한 관리자 자격으로 읽는다(0102 로 관리자 SELECT 정책이 생겼다).
  // 정책이 맞으면 우회할 이유가 없고, 우회가 남아 있으면 다음에 또
  // 「건수는 보이는데 눌러도 못 읽는」 상태가 생긴다.
  // 호출부는 admin/layout.tsx:34 · admin/dashboard/page.tsx:45 둘뿐이고 둘 다 관리자 확인을 지난다.
  //
  // 아래 셋(advertiser_profiles · proposals · campaigns)은 그대로 둔다 —
  // advertiser_profiles 는 관리자 정책이 있지만(0095:70) 나머지 둘은 확인하지 못했다.
  // 확인 없이 되돌리면 건수가 조용히 0 이 된다(별도 건).
  const me = await createClient()

  const [openRes, unpaidRes, bizRes, propRes] = await Promise.all([
    me.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    me.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open').eq('type', 'unpaid'),
    db
      .from('advertiser_profiles')
      .select('user_id', { count: 'exact', head: true })
      .not('biz_doc_url', 'is', null),
    db
      .from('proposals')
      .select(
        'id, budget, settled_at, paid_confirmed_at, paid_disputed_at, settlement_status, campaign_id, settlement_date',
      )
      .eq('advertiser_confirmed', true)
      .eq('influencer_confirmed', true),
  ])

  const props = propRes.data ?? []
  const campaignIds = [...new Set(props.map((p) => p.campaign_id).filter(Boolean))]

  const campById: Record<string, { title: string; settlement_date: string | null }> = {}
  if (campaignIds.length > 0) {
    const { data: camps } = await db
      .from('campaigns')
      .select('id, title, settlement_date')
      .in('id', campaignIds)
    for (const c of camps ?? []) campById[c.id] = { title: c.title, settlement_date: c.settlement_date }
  }

  // 인플루언서 정산 화면(earnings)의 판정 순서를 그대로 따른다 —
  // 완료 → 확인 대기 → 미수 → 예정. 순서가 바뀌면 같은 건이 다른 칸에 들어간다.
  const today = kstDateString()
  const overdueRows: OverdueRow[] = []
  for (const p of props) {
    if (p.paid_confirmed_at || p.settlement_status === '완료') continue
    if (p.settled_at && !p.paid_confirmed_at && !p.paid_disputed_at) continue
    const camp = p.campaign_id ? campById[p.campaign_id] : null
    const settlementDate = settlementDateOf(p, camp)
    if (!settlementDate || settlementDate >= today) continue
    overdueRows.push({
      proposalId: p.id,
      campaignTitle: camp?.title ?? '(제목 없음)',
      settlementDate,
      budget: p.budget,
    })
  }
  overdueRows.sort((a, b) => a.settlementDate.localeCompare(b.settlementDate))

  return {
    unpaidReports: unpaidRes.count ?? 0,
    openReports: openRes.count ?? 0,
    bizPending: bizRes.count ?? 0,
    overdue: overdueRows.length,
    overdueRows,
    unregistered: unregisteredBatches(),
  }
}
