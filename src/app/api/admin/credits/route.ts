import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { NextResponse } from 'next/server'

// 관리자 전용 크레딧 조회.
// credit_balances 는 0104 로 security_invoker 가 켜져 브라우저 자격에서는 「내 행」만 보인다
// (원장 정책이 auth.uid() = user_id 하나뿐 — 0018:41).
// 남의 잔액·이력은 이 경로로만 읽는다. 관리자 확인을 서버에서 하고 그 뒤에만 service 를 쓴다.
export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: '관리자 권한이 필요해요.' }, { status: 403 })

  const db = createServiceClient()
  const userId = new URL(req.url).searchParams.get('userId')

  // ── 한 명의 원장 이력 ──
  if (userId) {
    const { data, error } = await db
      .from('credit_ledger')
      .select('id, delta, reason_code, memo, ref_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ledger: data ?? [] })
  }

  // ── 회원 목록 + 잔액 ──
  const [{ data: profiles }, { data: privs }, { data: balances }] = await Promise.all([
    db.from('profiles').select('id, name, role').neq('role', 'admin').order('created_at', { ascending: false }),
    db.from('user_private').select('user_id, email'),
    db.from('credit_balances').select('user_id, balance'),
  ])

  const emailOf = Object.fromEntries((privs ?? []).map(p => [p.user_id, p.email]))
  const balanceOf = Object.fromEntries((balances ?? []).map(b => [b.user_id, b.balance]))

  return NextResponse.json({
    users: (profiles ?? []).map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      email: emailOf[p.id] ?? '',
      balance: balanceOf[p.id] ?? 0,
    })),
  })
}
