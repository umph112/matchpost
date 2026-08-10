import { NextResponse } from 'next/server'
import { requireCronOrAdmin } from '@/lib/admin/requireCronOrAdmin'
import { attachmentExpiresAt, storagePathFromPublicUrl } from '@/lib/storage'

// D6 F3 — 대시 첨부파일은 업로드일로부터 7일 뒤 실제 파일만 지운다.
// 메시지 행(파일명·시각·보낸사람)은 분쟁 대응을 위해 그대로 남기고, file_deleted_at만 채운다.
async function handler(req: Request) {
  const auth = await requireCronOrAdmin(req)
  if (!auth.ok) return auth.response

  const { data: rows, error } = await auth.admin
    .from('messages')
    .select('id, file_url, created_at')
    .not('file_url', 'is', null)
    .is('file_deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const due = (rows ?? []).filter((r: { created_at: string }) => attachmentExpiresAt(r.created_at).getTime() <= Date.now())

  let deleted = 0
  const failed: string[] = []
  for (const r of due) {
    const path = storagePathFromPublicUrl(r.file_url as string, 'chat-files')
    if (path) {
      const { error: rmErr } = await auth.admin.storage.from('chat-files').remove([path])
      if (rmErr) {
        failed.push(r.id)
        continue
      }
    }
    const { error: updErr } = await auth.admin
      .from('messages')
      .update({ file_deleted_at: new Date().toISOString() })
      .eq('id', r.id)
    if (updErr) failed.push(r.id)
    else deleted++
  }

  return NextResponse.json({ ok: true, checked: rows?.length ?? 0, deleted, failed })
}

export const GET = handler
export const POST = handler
