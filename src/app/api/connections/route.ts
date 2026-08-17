import { NextResponse } from 'next/server'
import { registerConnection, unregisterConnection } from '@/lib/connections/actions'

// 친구등록(manual) — 광고주가 검색·프로필에서 직접 등록. 상대 승낙 불필요, 인플루언서에게 알림.
// D12 B-4: 모달 없이 즉시 반영되는 되돌리기 쉬운 행동.
export async function POST(req: Request) {
  const { influencerId } = await req.json().catch(() => ({}))
  if (!influencerId) return NextResponse.json({ error: 'influencerId가 필요해요.' }, { status: 400 })

  const res = await registerConnection(influencerId, 'manual')
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true, id: res.id })
}

// 친구등록 해제 — 다시 누르면 관계 삭제. ⚠️ 상대에게 알리지 않는다.
export async function DELETE(req: Request) {
  const { influencerId } = await req.json().catch(() => ({}))
  if (!influencerId) return NextResponse.json({ error: 'influencerId가 필요해요.' }, { status: 400 })

  const res = await unregisterConnection(influencerId)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
