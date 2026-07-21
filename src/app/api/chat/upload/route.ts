import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 채팅 파일 업로드: chat-files 버킷에 service_role로 업로드 후 public URL 반환
export async function POST(req: Request) {
  const form = await req.formData()
  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없어요.' }, { status: 400 })
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: '20MB 이하만 업로드 가능해요.' }, { status: 400 })

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
  const path = `chat/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
  const buf = new Uint8Array(await file.arrayBuffer())

  const { error } = await admin.storage.from('chat-files').upload(path, buf, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const { data } = admin.storage.from('chat-files').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl, name: file.name, type: file.type })
}
