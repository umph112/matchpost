import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: '매치포스트', template: '%s · 매치포스트' },
  description:
    '광고주와 인플루언서가 직접 만나는 협업 플랫폼. 날짜 · 지역 · 분야로 찾고, 대화 한 번으로 협업이 시작됩니다.',
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
