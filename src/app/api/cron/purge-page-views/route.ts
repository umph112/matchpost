import { NextResponse } from 'next/server'
import { requireCronOrAdmin } from '@/lib/admin/requireCronOrAdmin'

// D30 [1] — page_views 롤업.
//
// 매 조회마다 한 행이라 원본은 커진다. 90일 넘은 행은 지우되, **지우기 전에 집계로 남긴다** —
// 3개월 전 저녁 트래픽도 비교선으로 필요하다.
//
// 순서(집계 → 삭제)와 재실행 안전성은 SQL 함수 run_page_view_rollup(0097) 안에 있다.
// 수만 행을 API 로 끌어와 세면 느리고 중간에 끊기면 구간이 빈다 — 그래서 DB 에서 한 번에 돈다.
async function handler(req: Request) {
  const auth = await requireCronOrAdmin(req)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.admin.rpc('run_page_view_rollup', { p_keep_days: 90 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const row = Array.isArray(data) ? data[0] : data
  return NextResponse.json({
    ok: true,
    hours: row?.hours ?? 0,
    paths: row?.paths ?? 0,
    purged: row?.purged ?? 0,
  })
}

export const GET = handler
export const POST = handler
