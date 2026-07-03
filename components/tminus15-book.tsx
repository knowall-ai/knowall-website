import Image from 'next/image';
import type { CSSProperties } from 'react';

/**
 * T-Minus-15 book rendered as a real, closed book: the cover image you see, plus a
 * visible page-edge that gives the book thickness. Depth is kept deliberately thin
 * (~100 pages). Pure CSS 3D — the six faces are laid out around a centred cube, so
 * hover just eases the tilt. Decorative: only the cover carries alt text.
 */

// Cream page edges — fine striations reading as stacked page fore-edges.
const PAGE_EDGE =
  'repeating-linear-gradient(to right, #efe9db 0, #efe9db 1px, #c9bea4 1px, #c9bea4 2.2px)';

// CSS custom properties drive every face; width is fluid, height follows the 533×800
// cover aspect, depth is the page block. Half-values position the centred faces.
const bookVars = {
  '--w': 'clamp(216px, 40vw, 288px)',
  '--h': 'calc(var(--w) * 800 / 533)',
  '--d': '16px',
  '--hw': 'calc(var(--w) / 2)',
  '--hh': 'calc(var(--h) / 2)',
  '--hd': 'calc(var(--d) / 2)',
  width: 'var(--w)',
  height: 'var(--h)',
} as CSSProperties;

const face = 'absolute left-1/2 top-1/2';

export default function TMinus15Book() {
  return (
    <div className="relative [perspective:1600px]">
      <div
        className="absolute -inset-8 rounded-3xl bg-lime-500/10 blur-2xl"
        aria-hidden="true"
      ></div>
      <div
        className="relative transition-transform duration-500 [transform-style:preserve-3d] [transform:rotateX(5deg)_rotateY(-25deg)] hover:[transform:rotateX(3deg)_rotateY(-12deg)]"
        style={bookVars}
      >
        {/* Back cover */}
        <div
          aria-hidden="true"
          className={`${face} rounded-l-md`}
          style={{
            width: 'var(--w)',
            height: 'var(--h)',
            background: 'linear-gradient(#1f2937, #0b0f16)',
            transform: 'translate(-50%, -50%) translateZ(calc(-1 * var(--hd))) rotateY(180deg)',
          }}
        ></div>
        {/* Spine (bound left edge) */}
        <div
          aria-hidden="true"
          className={face}
          style={{
            width: 'var(--d)',
            height: 'var(--h)',
            background: 'linear-gradient(to right, #141a12, #2a3320)',
            transform: 'translate(-50%, -50%) rotateY(-90deg) translateZ(var(--hw))',
          }}
        ></div>
        {/* Fore-edge (right) — the visible page block */}
        <div
          aria-hidden="true"
          className={face}
          style={{
            width: 'var(--d)',
            height: 'var(--h)',
            backgroundImage: PAGE_EDGE,
            transform: 'translate(-50%, -50%) rotateY(90deg) translateZ(var(--hw))',
          }}
        ></div>
        {/* Top pages */}
        <div
          aria-hidden="true"
          className={face}
          style={{
            width: 'var(--w)',
            height: 'var(--d)',
            backgroundImage: PAGE_EDGE,
            transform: 'translate(-50%, -50%) rotateX(90deg) translateZ(var(--hh))',
          }}
        ></div>
        {/* Bottom pages */}
        <div
          aria-hidden="true"
          className={face}
          style={{
            width: 'var(--w)',
            height: 'var(--d)',
            background: 'linear-gradient(#d8d0be, #b8ad95)',
            transform: 'translate(-50%, -50%) rotateX(-90deg) translateZ(var(--hh))',
          }}
        ></div>
        {/* Front cover */}
        <div
          className={face}
          style={{
            width: 'var(--w)',
            height: 'var(--h)',
            transform: 'translate(-50%, -50%) translateZ(var(--hd))',
          }}
        >
          <Image
            src="/images/products/tminus15-book.png"
            alt="T-Minus-15: Secrets of an Elite DevOps Team book cover"
            width={533}
            height={800}
            loading="eager"
            className="h-full w-full rounded-l-sm rounded-r-md border border-l-0 border-gray-700 shadow-2xl shadow-lime-500/20"
          />
        </div>
      </div>
    </div>
  );
}
