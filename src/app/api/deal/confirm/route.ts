import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 상호 협업 확정: 로그인 사용자가 제안의 광고주/인플루언서 중 어느 쪽인지 서버에서 판별해
// 본인 쪽 확인 플래그만 set. 양쪽 확인되면 DB 트리거가 '상호협의 완료' 알림 발송.
export async function POST(req: Request) {
  const { proposalId } = await req.json()
  if (!proposalId) return NextResponse.json({ error: 'proposalId가 필요해요.' }, { status: 400 })

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: proposal } = await admin
    .from('proposals')
    .select('advertiser_id, influencer_id')
    .eq('id', proposalId)
    .single()
  if (!proposal) return NextResponse.json({ error: '제안을 찾을 수 없어요.' }, { status: 404 })

  let patch: Record<string, boolean> | null = null
  if (user.id === proposal.advertiser_id) patch = { advertiser_confirmed: true }
  else if (user.id === proposal.influencer_id) patch = { influencer_confirmed: true }
  else return NextResponse.json({ error: '이 협업의 당사자가 아니에요.' }, { status: 403 })

  const { error } = await admin.from('proposals').update(patch).eq('id', proposalId)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
