import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

// 이미 로그인한 상태에서 초대 링크를 연 경우 — 새로 가입하지 않고 지금 계정으로 합류한다.
// 단, 한 사람이 여러 회사에 동시에 소속되진 않는다(정산·권한이 흩어짐) → 이미 다른 회사의
// active 멤버면 막고 안내만 한다.
export async function POST(req: Request) {
  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: '유효하지 않은 초대 링크예요.' }, { status: 400 })

  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

  const db = createServiceClient()
  const { data: row } = await db
    .from('team_members')
    .select('id, owner_id, status, token_expires')
    .eq('invite_token', token)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: '유효하지 않은 초대 링크예요.' }, { status: 400 })
  if (row.status !== 'invited') return NextResponse.json({ error: '이미 사용된 초대 링크예요.' }, { status: 400 })
  if (row.token_expires && new Date(row.token_expires) < new Date()) {
    return NextResponse.json({ error: '만료된 초대 링크예요.' }, { status: 400 })
  }

  // 이미 다른 회사에 소속돼 있으면 차단
  const { data: existing } = await db
    .from('team_members')
    .select('owner_id')
    .eq('member_id', user.id)
    .eq('status', 'active')
    .neq('owner_id', row.owner_id)
    .maybeSingle()
  if (existing) {
    const { data: adv } = await db
      .from('advertiser_profiles')
      .select('company_name')
      .eq('user_id', existing.owner_id)
      .maybeSingle()
    return NextResponse.json(
      { error: 'already_member', company: adv?.company_name || '다른 회사' },
      { status: 409 }
    )
  }

  // 1회용 판정은 status 로 한다(위 23줄과 같은 규칙). invite_token 은 남긴다 —
  // 지우면 같은 링크 재방문이 「유효하지 않음」으로 떨어져 안내가 틀린다.
  // 링크 복사 버튼은 status === 'invited' 행에만 뜨므로 토큰이 남아도 노출되지 않는다.
  await db
    .from('team_members')
    .update({
      member_id: user.id,
      status: 'active',
      joined_at: new Date().toISOString(),
      token_expires: null,
    })
    .eq('id', row.id)

  return NextResponse.json({ ok: true })
}
