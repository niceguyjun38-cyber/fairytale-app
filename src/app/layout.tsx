import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: { default: '꼬마작가 동화공방 | 아이의 상상이 한 권의 책으로', template: '%s | 꼬마작가 동화공방' },
  description: '부모와 아이가 함께 만드는 우리만의 그림책. 이야기의 시작을 고르고, 말로 상상을 이어가고, 완성된 동화 속 단어로 영어도 배워보세요.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
