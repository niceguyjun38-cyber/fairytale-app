import type { ReactNode } from 'react';

export type IconName =
  | 'book' | 'sparkles' | 'arrow' | 'back' | 'mic' | 'check' | 'lock' | 'sound' | 'pen' | 'close'
  | 'play' | 'pause' | 'heart' | 'share' | 'moon' | 'left' | 'right' | 'trash' | 'eye' | 'eyeOff'
  | 'words' | 'brush' | 'library' | 'gift';

const paths: Record<IconName, ReactNode> = {
  book: <><path d="M12 7C8 4 4 4 2 5v15c3-1 7-1 10 1 3-2 7-2 10-1V5c-2-1-6-1-10 2Z" /><path d="M12 7v14" /></>,
  sparkles: <><path d="m12 3 2.3 6.2L20.5 12l-6.2 2.3L12 21l-2.3-6.7L3.5 12l6.2-2.8Z" /><path d="M19.5 2.5v4m-2-2h4" /></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  left: <path d="m15 5-7 7 7 7" />,
  right: <path d="m9 5 7 7-7 7" />,
  mic: <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 10.5v1a7 7 0 0 0 14 0v-1M12 18.5v3" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  sound: <><path d="M11 4.5 6 9H3v6h3l5 4.5Z" /><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></>,
  pen: <><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  play: <path d="M7 4.5v15l12.5-7.5Z" />,
  pause: <><rect x="6" y="4.5" width="4" height="15" rx="1" /><rect x="14" y="4.5" width="4" height="15" rx="1" /></>,
  heart: <path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.7 4 7.2 4c2 0 3.6 1.2 4.8 3 1.2-1.8 2.8-3 4.8-3 3.5 0 5.6 3.3 4.4 6.7C19.5 15.4 12 20 12 20Z" />,
  share: <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" /></>,
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />,
  trash: <><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
  eye: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7c1.9 0 3.5-.6 4.9-1.4" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>,
  words: <><path d="M4 19V6a2 2 0 0 1 2-2h12v15H6a2 2 0 0 0-2 2Zm0 0a2 2 0 0 0 2 2h12" /><path d="M8.5 13 10.5 8l2 5m-3.3-1.5h2.6" /></>,
  brush: <><path d="M18.5 3.5 10 12l2 2 8.5-8.5a1.4 1.4 0 0 0-2-2Z" /><path d="M10 12c-2.5 0-4 1.6-4 3.8 0 1.6-.8 2.7-2.5 3.2 4.4 1.3 8.5-.3 8.5-5Z" /></>,
  library: <><path d="M4 4h4v16H4zM10 4h4v16h-4z" /><path d="m16.5 4.8 3.8-1 3 15.4-3.8 1Z" /></>,
  gift: <><rect x="3" y="8" width="18" height="5" rx="1" /><path d="M5 13v8h14v-8M12 8v13M12 8c-1.5-3.5-6-4-6-1s6 1 6 1Zm0 0c1.5-3.5 6-4 6-1s-6 1-6 1Z" /></>,
};

export function Icon({ name, size = 20, filled = false }: { name: IconName; size?: number; filled?: boolean }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {paths[name]}
    </svg>
  );
}

export function KakaoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
      <path d="M12 3.5c-5.2 0-9.4 3.3-9.4 7.4 0 2.6 1.7 4.9 4.3 6.2l-1 3.7c-.1.3.3.6.6.4l4.4-2.9c.4 0 .7.1 1.1.1 5.2 0 9.4-3.3 9.4-7.4S17.2 3.5 12 3.5Z" />
    </svg>
  );
}
