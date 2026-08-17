import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

// 초대 링크(토큰) 조회 — /signup?invite=TOKEN 화면이 회사명·역할·유효성을 그려줄 때 쓴다.
// team_members.invite_token은 owner만 볼 수 있는 값(RLS)이라 service-role로 교차 조회한다.
// invalid/used/expired 는 200 + ok:false 로 내려, 프런트가 안내 박스를 분기하게 한다.
export async function GET(req: Request) {
  const token = (new URL(req.url).searchParams.get('token') ?? '').trim()
  if (!token) return NextResponse.json({ ok: false, reason: 'invalid' })

  const db = createServiceClient()
  const { data: row } = await db
    .from('team_members')
    .select('owner_id, email, role, status, token_expires')
    .eq('invite_token', token)
    .maybeSingle()

  if (!row) return NextResponse.json({ ok: false, reason: 'invalid' })
  if (row.status !== 'invited') return NextResponse.json({ ok: false, reason: 'used' })
  if (row.token_expires && new Date(row.token_expires) < new Date()) {
    return NextResponse.json({ ok: false, reason: 'expired' })
  }

  const { data: adv } = await db
    .from('advertiser_profiles')
    .select('company_name')
    .eq('user_id', row.owner_id)
    .maybeSingle()
  const { data: prof } = await db
    .from('profiles')
    .select('name')
    .eq('id', row.owner_id)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    email: row.email,
    role: row.role,
    companyName: adv?.company_name || prof?.name || '광고주',
  })
}
