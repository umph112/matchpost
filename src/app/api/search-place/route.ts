import { NextRequest, NextResponse } from 'next/server'

// 네이버 지역검색 프록시 — 장소명 검색 → 장소명 + 도로명(또는 지번) 주소.
// 인증키(NAVER_API_CLIENT_ID/SECRET)는 KGTR와 동일한 네이버 지역검색 키 재사용.
// 키 없으면 빈 배열 반환(그레이스풀).
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q || q.length < 2) return NextResponse.json([])

  const clientId = process.env.NAVER_API_CLIENT_ID
  const clientSecret = process.env.NAVER_API_CLIENT_SECRET
  if (!clientId || !clientSecret) return NextResponse.json([])

  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5&sort=random`
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
    },
  })
  if (!res.ok) return NextResponse.json([])

  const data = await res.json()
  const items = (data.items ?? []).map((item: { title: string; roadAddress?: string; address?: string }) => ({
    name: item.title.replace(/<[^>]+>/g, ''),
    address: item.roadAddress || item.address || '',
  }))
  return NextResponse.json(items)
}
