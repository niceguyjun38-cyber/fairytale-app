import type { ReactNode } from 'react';
export type IconName = 'book' | 'sparkles' | 'arrow' | 'back' | 'mic' | 'check' | 'lock' | 'sound' | 'pen' | 'close';
const paths: Record<IconName, ReactNode> = {
  book: <><path d="M12 7C8 4 4 4 2 5v15c3-1 7-1 10 1 3-2 7-2 10-1V5c-2-1-6-1-10 2Z"/><path d="M12 7v14"/></>,
  sparkles: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/><path d="M20 2v4m-2-2h4"/></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>, back: <path d="M19 12H5m6-6-6 6 6 6"/>,
  mic: <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-3 0h6"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4m-4 4v3"/></>,
  sound: <path d="m11 4-6 5H2v6h3l6 5Zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>,
  pen: <path d="m16 3 5 5L8 21H3v-5Zm-2 2 5 5"/>, close: <path d="m6 6 12 12M6 18 18 6"/>,
};
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>{paths[name]}</svg>;
}
