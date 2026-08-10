import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/requireAdmin'

// D7 5-2 — 서류 보기(서명 URL 발급) / 승인·반려 즉시 삭제. 비공개 버킷이라 관리자만 signed URL로 열람.
export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const userId = new URL(req.url).searchParams.get('userId')
  if (!userId) return NextResponse.json({ error: 'userId가 필요해요.' }, { status: 400 })

  const { data: adv } = await auth.admin.from('advertiser_profiles').select('biz_doc_url').eq('user_id', userId).single()
  if (!adv?.biz_doc_url) return NextResponse.json({ error: '서류가 없어요(이미 삭제됐을 수 있어요).' }, { status: 404 })

  const { data, error } = await auth.admin.storage.from('biz-docs').createSignedUrl(adv.biz_doc_url, 300)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ url: data.signedUrl })
}

// 승인/반려 처리 후 호출 — 서류 원본 삭제, 확인 결과(사업자등록번호)는 그대로 둔다
export async function DELETE(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { userId } = await req.json()
  if (!userId) return NextResponse.json({ error: 'userId가 필요해요.' }, { status: 400 })

  const { data: adv } = await auth.admin.from('advertiser_profiles').select('biz_doc_url').eq('user_id', userId).single()
  if (adv?.biz_doc_url) {
    await auth.admin.storage.from('biz-docs').remove([adv.biz_doc_url])
    await auth.admin.from('advertiser_profiles').update({ biz_doc_url: null }).eq('user_id', userId)
  }
  return NextResponse.json({ ok: true })
}
