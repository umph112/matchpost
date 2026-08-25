'use client'

// D30 [1] — 페이지 조회 비콘.
//
// 왜 여기(루트 레이아웃)인가:
//   · recordVisit 이 걸린 (dashboard)/layout.tsx 는 로그인 대시보드 전용이라 공개 페이지를 못 센다
//   · 서버 레이아웃은 pathname 을 모른다 — path 를 남기려면 클라이언트여야 한다
//   · 미들웨어는 이미 전 요청 getUser() 로 무거운 자리다. 거기에 DB write 를 더하지 않는다

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function PageViewTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname) return
    // keepalive — 기록을 기다리느라 화면 전환이 늦어지지 않게 한다. 실패해도 조용히 넘긴다.
    fetch('/api/track/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname }),
      keepalive: true,
    }).catch(() => {})
  }, [pathname])

  return null
}
