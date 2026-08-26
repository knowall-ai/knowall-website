'use client';

import { useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STARS_MAX } from '@/lib/product-reviews';

const sizeClasses = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
} as const;

type StarSize = keyof typeof sizeClasses;

/**
 * Read-only star rating display. Renders partial fills (e.g. 4.3 stars).
 * Ported from robotechy.com's StarRating, restyled for the dark shop theme.
 */
export function StarRating({
  stars,
  maxStars = STARS_MAX,
  size = 'md',
  className,
  label,
}: {
  /** Rating in stars, 0..5 (supports fractional values for partial fill). */
  stars: number;
  maxStars?: number;
  size?: StarSize;
  className?: string;
  /** Accessible label; defaults to "N out of M stars". */
  label?: string;
}) {
  const value = Number.isFinite(stars) ? Math.max(0, Math.min(maxStars, stars)) : 0;
  const aria = label ?? `${value.toFixed(1)} out of ${maxStars} stars`;

  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role="img"
      aria-label={aria}
      title={aria}
    >
      {Array.from({ length: maxStars }, (_, index) => {
        const fillPercentage = Math.min(Math.max(value - index, 0), 1) * 100;
        return (
          <span key={index} className="relative inline-flex" aria-hidden="true">
            <Star className={cn(sizeClasses[size], 'text-gray-700')} strokeWidth={1.5} />
            <span
              className="absolute inset-0 overflow-hidden"
              style={{ width: `${fillPercentage}%` }}
            >
              <Star
                className={cn(sizeClasses[size], 'fill-amber-400 text-amber-400')}
                strokeWidth={1.5}
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Interactive 1..N star picker. Accessible: an ARIA radiogroup of star buttons
 * with full keyboard support (arrow keys to change, click/Enter/Space to set).
 */
export function StarRatingInput({
  value,
  onChange,
  maxStars = STARS_MAX,
  size = 'lg',
  className,
  disabled = false,
  label = 'Your rating',
  labelledBy,
}: {
  /** Selected rating in whole stars, 0..5 (0 = none). */
  value: number;
  onChange: (stars: number) => void;
  maxStars?: number;
  size?: StarSize;
  className?: string;
  disabled?: boolean;
  /** Accessible group label, e.g. "Your rating". */
  label?: string;
  /** id of an external element labelling the group (takes precedence over `label`). */
  labelledBy?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const setStars = (next: number) => {
    if (disabled) return;
    const clamped = Math.max(0, Math.min(maxStars, next));
    onChange(clamped);
    // Roving tabindex: move focus to the active star so screen readers
    // announce it and keyboard navigation stays predictable. When the
    // selection is cleared to 0 the first star holds the group's tab stop.
    const focusIndex = clamped >= 1 ? clamped - 1 : 0;
    buttonsRef.current[focusIndex]?.focus();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (disabled) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      setStars(Math.min(maxStars, (value || 0) + 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      // Stepping down to 0 lets keyboard users clear the selection.
      setStars(Math.max(0, (value || 0) - 1));
    }
  };

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setHover(null)}
    >
      {Array.from({ length: maxStars }, (_, index) => {
        const starValue = index + 1;
        const filled = shown >= starValue;
        return (
          <button
            key={index}
            ref={(el) => {
              buttonsRef.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === starValue}
            aria-label={`${starValue} ${starValue === 1 ? 'star' : 'stars'}`}
            tabIndex={value === starValue || (value === 0 && index === 0) ? 0 : -1}
            disabled={disabled}
            onClick={() => setStars(starValue)}
            onMouseEnter={() => !disabled && setHover(starValue)}
            className={cn(
              'rounded-sm transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-lime-500',
              !disabled && 'cursor-pointer hover:scale-110',
              disabled && 'cursor-not-allowed opacity-60'
            )}
          >
            <Star
              className={cn(
                sizeClasses[size],
                filled ? 'fill-amber-400 text-amber-400' : 'text-gray-700'
              )}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}
