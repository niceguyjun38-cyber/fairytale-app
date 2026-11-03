import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'https://fairytale-app-silk.vercel.app';
const DESC = '아이가 말하면 이야기가 되고, 이야기는 그림책이 돼요. 우리 아이의 상상으로 만드는 단 한 권의 AI 그림책 — 목소리 낭독과 영어 단어까지.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: '꼬마작가 동화공방 · 우리 아이가 작가가 되는 그림책', template: '%s · 꼬마작가 동화공방' },
  description: DESC,
  openGraph: {
    type: 'website',
    siteName: '꼬마작가 동화공방',
    title: '꼬마작가 동화공방 · 우리 아이가 작가가 되는 그림책',
    description: DESC,
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: '달빛 아래 동화마을' }],
    locale: 'ko_KR',
  },
  twitter: { card: 'summary_large_image', images: ['/og.jpg'] },
};

export const viewport: Viewport = {
  themeColor: '#0b1228',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
