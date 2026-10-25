import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

/** Brand-lime circle showing a name's first letter: the fallback when a profile has no picture. */
export function InitialChip({
  name,
  className,
  ...props
}: { name: string } & ComponentProps<'span'>) {
  return (
    <span
      {...props}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-semibold text-brand-foreground',
        className
      )}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
