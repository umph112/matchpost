import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // D31 [1] — /influencer · /advertiser 를 여기서 막지 않는다.
  //
  // startsWith 라서 공개 화면인 /influencer/[id] · /advertiser/[id] 까지 삼켰다.
  // 인플루언서가 자기 프로필 링크를 밖에 뿌려도 받는 쪽엔 로그인 화면이 떴다.
  //
  // 로그인이 필요한 화면은 전부 (dashboard) 그룹 안에 있고, 그 layout.tsx 들이
  // 서버에서 이미 redirect('/login') 한다 — (dashboard)/layout.tsx · influencer/layout.tsx ·
  // advertiser/layout.tsx 셋 다. 여기 목록은 그 위에 얹힌 중복이었다.
  // 경로 목록을 손으로 관리하면 화면이 늘 때마다 빠진다. 레이아웃에 맡기는 쪽이 안 빠진다.
  //
  // /admin 만 남긴다 — 관리자 화면은 (dashboard) 밖이라 그룹 레이아웃이 안 씌워진다.
  // (admin/layout.tsx 도 따로 막고 있어 여기가 유일한 방어선은 아니다)
  const protectedRoutes = ['/admin']
  const isProtected = protectedRoutes.some(route =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}