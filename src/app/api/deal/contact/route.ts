import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// 협의 완료 시 연락처 공개: 양쪽(advertiser_confirmed && influencer_confirmed)이 모두
// 확정된 경우에만 요청자에게 '상대방'의 연락처(이름·전화·이메일)를 반환.
// user_private RLS는 본인·관리자만 허용하므로 여기서만 service_role로 우회하되,
// 반드시 (1) 요청자가 당사자이고 (2) 양쪽 확정 완료일 때만 공개한다.
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
    .select('advertiser_id, influencer_id, advertiser_confirmed, influencer_confirmed, contact_hidden_at')
    .eq('id', proposalId)
    .single()
  if (!proposal) return NextResponse.json({ error: '제안을 찾을 수 없어요.' }, { status: 404 })

  // 당사자 검증 + 상대방 id 결정
  let otherId: string
  if (user.id === proposal.advertiser_id) otherId = proposal.influencer_id
  else if (user.id === proposal.influencer_id) otherId = proposal.advertiser_id
  else return NextResponse.json({ error: '이 협업의 당사자가 아니에요.' }, { status: 403 })

  // 양쪽 확정 완료일 때만 공개
  if (!(proposal.advertiser_confirmed && proposal.influencer_confirmed)) {
    return NextResponse.json({ error: '협의 완료 후 연락처가 공개돼요.' }, { status: 403 })
  }

  // 정산 완료 5일 후 재차단
  if (proposal.contact_hidden_at && new Date(proposal.contact_hidden_at).getTime() < Date.now()) {
    return NextResponse.json({ error: '정산 후 5일이 지나 연락처가 비공개로 전환됐어요.' }, { status: 403 })
  }

  const { data: priv } = await admin
    .from('user_private')
    .select('real_name, phone, email')
    .eq('user_id', otherId)
    .single()

  const { data: prof } = await admin.from('profiles').select('name').eq('id', otherId).single()

  await admin.from('contact_reveal_log').insert({ proposal_id: proposalId, viewer_id: user.id })

  return NextResponse.json({
    name: priv?.real_name || prof?.name || '상대방',
    phone: priv?.phone ?? '',
    email: priv?.email ?? '',
  })
}
