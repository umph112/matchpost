import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { requireAdmin } from './requireAdmin'

// Vercel Cron 경로(CRON_SECRET 헤더, 세션 없음) 또는 관리자 수동 트리거(로그인 세션) 둘 다 허용.
// 관리자 배치 라우트는 crons.json이 GET으로, 관리자 화면은 POST로 같은 핸들러를 부른다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function requireCronOrAdmin(req: Request): Promise<{ ok: true; admin: any } | { ok: false; response: NextResponse }> {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) {
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    return { ok: true, admin }
  }
  return requireAdmin()
}
