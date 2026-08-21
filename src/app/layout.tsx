import type { Metadata } from "next";
import { SITE_URL } from "@/lib/siteUrl";
import "./globals.css";

const DESCRIPTION =
  '광고주와 인플루언서가 직접 만나는 협업 플랫폼. 날짜 · 지역 · 분야로 찾고, 대화 한 번으로 협업이 시작됩니다.';

export const metadata: Metadata = {
  // 절대 URL 기준점 — canonical·og:image 의 상대경로가 이 값으로 절대화된다.
  // 값은 NEXT_PUBLIC_SITE_URL(env) → siteUrl.ts 단일 출처. 도메인 확정 시 env 만 교체하면 전부 따라온다.
  metadataBase: new URL(SITE_URL),
  title: { default: '매치포스트', template: '%s · 매치포스트' },
  description: DESCRIPTION,
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '매치포스트',
    title: '매치포스트',
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
