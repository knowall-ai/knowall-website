'use client';

import type { ReactNode } from 'react';
import { useContactPanel } from '@/components/contact-panel';

/**
 * Inline "message us" affordance used across the shop policy pages — opens the
 * site's Message side panel (same as the header's Message button).
 */
export function MessageUsLink({ children }: { children: ReactNode }) {
  const { openContactPanel } = useContactPanel();
  return (
    <button
      type="button"
      onClick={() => openContactPanel()}
      className="underline text-brand hover:text-brand-hover transition-colors"
    >
      {children}
    </button>
  );
}
