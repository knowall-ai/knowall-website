'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/** Do Not Track or Global Privacy Control is on: send nothing. */
export function privacySignal(nav: Navigator = navigator): boolean {
  const n = nav as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const w =
    typeof window !== 'undefined' ? (window as Window & { doNotTrack?: string }) : undefined;
  return (
    n.globalPrivacyControl === true ||
    n.doNotTrack === '1' ||
    n.msDoNotTrack === '1' ||
    w?.doNotTrack === '1'
  );
}

/**
 * Counts a page view on each route change with one small same-origin beacon.
 * No cookies, no storage, no third-party script: the server hashes the visit
 * into an anonymous daily id (lib/analytics/privacy.ts). The external referrer
 * is sent with the first view only.
 */
export default function PageViewBeacon() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (!pathname || privacySignal()) return;
    const referrer = first.current ? document.referrer : '';
    first.current = false;
    const body = JSON.stringify({ path: pathname, title: document.title, referrer });
    try {
      if (!navigator.sendBeacon?.('/api/collect', new Blob([body], { type: 'application/json' }))) {
        void fetch('/api/collect', { method: 'POST', body, keepalive: true }).catch(() => {});
      }
    } catch {
      /* analytics must never break the page */
    }
  }, [pathname]);

  return null;
}
