import { NextResponse } from 'next/server'
import { requireCronOrAdmin } from '@/lib/admin/requireCronOrAdmin'

// 관리자 수동 호출(POST) 또는 Vercel Cron(GET, vercel.json) 둘 다 이 핸들러를 탄다.
async function handler(req: Request) {
  const auth = await requireCronOrAdmin(req)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.admin.rpc('run_visit_weekly_batch')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, processed: data?.length ?? 0, results: data })
}

export const GET = handler
export const POST = handler
