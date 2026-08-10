import { NextResponse } from 'next/server'
import { requireCronOrAdmin } from '@/lib/admin/requireCronOrAdmin'

async function handler(req: Request) {
  const auth = await requireCronOrAdmin(req)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.admin.rpc('run_settlement_reminder_batch')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, processed: data?.length ?? 0, results: data })
}

export const GET = handler
export const POST = handler
