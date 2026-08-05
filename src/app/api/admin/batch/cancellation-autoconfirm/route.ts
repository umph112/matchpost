import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/requireAdmin'

// 관리자 전용 수동 호출. 크론 연결은 다음 차수(Vercel Cron).
export async function POST() {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  const { data, error } = await auth.admin.rpc('run_cancellation_autoconfirm_batch')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, processed: data?.length ?? 0, results: data })
}
