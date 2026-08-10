import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

// D7 5-1 — 사업자등록증 업로드. 계정 생성 직후(로그인된 상태)에 별도로 올린다.
// 비공개 버킷(biz-docs)에 저장 — 승인/반려 즉시 또는 30일 뒤 자동 삭제된다(5-2).
export async function POST(req: Request) {
  const auth = await createServerClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요.' }, { status: 401 })

  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없어요.' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: '10MB 이하만 업로드 가능해요.' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `${user.id}/${Date.now()}.${ext}`
  const buf = new Uint8Array(await file.arrayBuffer())

  const { error: upErr } = await admin.storage.from('biz-docs').upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: true,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 })

  const { error: updErr } = await admin
    .from('advertiser_profiles')
    .update({ biz_doc_url: path, biz_doc_uploaded_at: new Date().toISOString() })
    .eq('user_id', user.id)
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
