import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 관리자 전용: 특정 유저에게 크레딧 지급(양수) 또는 차감(음수 amount)
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

  // 관리자 확인
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!profile?.is_admin) return NextResponse.json({ error: '관리자 권한이 필요해요.' }, { status: 403 })

  const { targetUserId, amount, description } = await req.json()
  if (!targetUserId || amount === undefined || amount === 0) {
    return NextResponse.json({ error: 'targetUserId, amount가 필요해요.' }, { status: 400 })
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const isGrant = amount > 0
  const { error } = isGrant
    ? await admin.rpc('credit_ledger_grant', {
        p_user_id: targetUserId,
        p_amount: Math.abs(amount),
        p_kind: 'admin',
        p_reason_code: 'admin_grant',
        p_memo: description || '관리자 수동 지급',
        p_admin_id: user.id,
      })
    : await admin.rpc('credit_ledger_charge', {
        p_user_id: targetUserId,
        p_amount: Math.abs(amount),
        p_reason_code: 'admin_deduct',
        p_memo: description || '관리자 수동 차감',
        p_kind: 'admin',
      })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
