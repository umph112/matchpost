import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 협업 확정 토글: 내 쪽 confirmed를 현재값의 반대로 업데이트.
// 개시자(initiated_by)는 proposal insert 시 이미 true로 생성된다.
// ⚠️ 진행일(캠페인 date 또는 오픈 date)이 없으면 확정 불가.
// ⚠️ 양쪽 모두 true가 되는 순간 DB 트리거가 연락처 공개 + 축하 크레딧 처리.
export async function POST(req: Request) {
  const { proposalId } = await req.json()
  if (!proposalId) return NextResponse.json({ error: 'proposalId가 필요해요.' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: proposal } = await admin
    .from('proposals')
    .select('advertiser_id, influencer_id, advertiser_confirmed, influencer_confirmed, campaign_id, schedule_id')
    .eq('id', proposalId)
    .single()
  if (!proposal) return NextResponse.json({ error: '제안을 찾을 수 없어요.' }, { status: 404 })

  // 당사자 판별
  const isAdvertiser = user.id === proposal.advertiser_id
  const isInfluencer = user.id === proposal.influencer_id
  if (!isAdvertiser && !isInfluencer) {
    return NextResponse.json({ error: '이 협업의 당사자가 아니에요.' }, { status: 403 })
  }

  // 진행일 체크 — campaign.date 또는 schedule.date 중 하나라도 있어야 확정 가능
  let hasDate = false
  if (proposal.campaign_id) {
    const { data: c } = await admin
      .from('campaigns')
      .select('date')
      .eq('id', proposal.campaign_id)
      .single()
    hasDate = !!c?.date
  } else if (proposal.schedule_id) {
    const { data: s } = await admin
      .from('schedules')
      .select('date')
      .eq('id', proposal.schedule_id)
      .single()
    hasDate = !!s?.date
  }
  if (!hasDate) {
    return NextResponse.json(
      { error: '진행일이 없으면 확정할 수 없어요. 먼저 일정을 입력해주세요.' },
      { status: 422 },
    )
  }

  // 토글
  const currentValue = isAdvertiser
    ? proposal.advertiser_confirmed
    : proposal.influencer_confirmed
  const patch = isAdvertiser
    ? { advertiser_confirmed: !currentValue }
    : { influencer_confirmed: !currentValue }

  const { error } = await admin.from('proposals').update(patch).eq('id', proposalId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true, confirmed: !currentValue })
}
