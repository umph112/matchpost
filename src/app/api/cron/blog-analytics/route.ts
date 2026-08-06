import { NextResponse } from 'next/server'
import { runBlogAnalyzerBatch } from '@/lib/blogAnalyzer/run'

// Vercel Cron 전용 — 매일 22:00 KST(13:00 UTC), vercel.json 참고.
// 세션 없이 CRON_SECRET 헤더만으로 인증(Vercel이 자동으로 Authorization: Bearer $CRON_SECRET을 붙여 호출).
export const maxDuration = 60 // Hobby 플랜 최대치 — 인플루언서 늘어나면 Pro로 올려야 함(아래 파일 주석 참고)

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const result = await runBlogAnalyzerBatch()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    // 배치 전체가 죽어도 다음날 크론이 다시 돈다 — 여기선 로그만 남기고 500 반환
    console.error('[cron/blog-analytics] batch failed', e)
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
