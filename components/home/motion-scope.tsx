'use client';

import type React from 'react';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Wraps an animated scene. It marks itself `data-inview` so CSS can pause
 * every animation inside while it is off screen, and, with `parallax`, it
 * publishes how far the scene has scrolled past the top of the viewport as
 * `--p` (0 to 1) for scroll-linked transforms. Under prefers-reduced-motion
 * it never sets `--p`, so the scene stays on its static frame.
 */
export default function MotionScope({
  children,
  className,
  parallax = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { parallax?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = false;
    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)));
      el.style.setProperty('--p', p.toFixed(4));
    };
    const onScroll = () => {
      if (visible && !frame) frame = requestAnimationFrame(update);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      el.dataset.inview = String(visible);
      if (visible && parallax && !reduced) onScroll();
    });
    observer.observe(el);
    if (parallax && !reduced) window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [parallax]);

  return (
    <div ref={ref} className={cn('die-scope', className)} data-inview="false" {...rest}>
      {children}
    </div>
  );
}
