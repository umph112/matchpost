// D30 [1] — 페이지 조회 기록 (page_views).
//
// ⚠️ user_id 는 세션에서만 파생한다. 클라이언트가 보낸 값은 쓰지 않는다 —
//    비콘은 로그아웃 상태에서도 열려 있어야 해서 인증을 요구할 수 없다.
//    그래서 「누구인지」는 쿠키로만 정하고, 본문에서는 path 만 받는다.
//
// ⚠️ user_visit_log(하루 순방문자 · 리워드 판정의 원본)와는 별개다. 여기서 그 표를 건드리지 않는다.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * 화면 단위로 묶기 위해 id 자리를 [id] 로 접는다.
 * 접지 않으면 page_view_daily_path 가 캠페인 하나당 한 행이 되어 「어느 화면이 많이 열리나」를 못 본다.
 */
function normalizePath(raw: string): string {
  const path = raw.split('?')[0].split('#')[0]
  if (!path.startsWith('/')) return '/'
  const folded = path
    .split('/')
    .map((seg) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) || /^\d+$/.test(seg)
        ? '[id]'
        : seg,
    )
    .join('/')
  return folded.slice(0, 200)
}

export async function POST(req: Request) {
  let path = '/'
  try {
    const body = await req.json()
    if (typeof body?.path === 'string') path = normalizePath(body.path)
  } catch {
    // 본문이 깨졌으면 경로 없이라도 한 건은 센다
  }

  let userId: string | null = null
  try {
    const supabase = await createClient()
    const { data } = await supabase.auth.getUser()
    userId = data.user?.id ?? null
  } catch {
    // 세션을 못 읽어도 로그아웃 방문으로 기록한다
  }

  try {
    await createServiceClient().from('page_views').insert({ user_id: userId, path })
  } catch {
    // 기록 실패가 화면을 막지 않는다
  }

  return NextResponse.json({ ok: true })
}
