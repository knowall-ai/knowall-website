'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { subscribeMouth } from '@/components/sallie-voice';

/**
 * Sallie's animated avatar. The robot rig is Sallie's approved call-bot
 * plate; the backdrop carries the ambient motion (twinkling, drifting stars
 * and a lime aura that breathes faster while she's thinking). Her mouth is a
 * five-bar speaker slot driven by the live level of her own voice — the same
 * audio-driven treatment her live-call rig uses — and sits still when she is
 * silent. Ambient animation is switched off under `prefers-reduced-motion`.
 */

// Deterministic starfield so server and client render the same sky.
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const VIEW_W = 1600;
const VIEW_H = 900;

const STARS = (() => {
  const rand = seeded(20250904);
  return Array.from({ length: 140 }, (_, i) => {
    const bright = i % 9 === 0;
    return {
      x: Math.round(rand() * VIEW_W),
      y: Math.round(rand() * VIEW_H),
      r: bright ? 1.6 + rand() * 1.2 : 0.5 + rand() * 1.1,
      bright,
      delay: -(rand() * 5).toFixed(2),
      duration: (3.5 + rand() * 4).toFixed(2),
    };
  });
})();

export function Starfield({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        'bg-[radial-gradient(ellipse_at_50%_100%,#152618_0%,#0b1310_45%,#050807_100%)]',
        className
      )}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
        className="absolute -inset-[3%] h-[106%] w-[106%] animate-sallie-drift motion-reduce:animate-none"
      >
        {STARS.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill={s.bright ? '#d9ffb0' : '#ffffff'}
            className="animate-sallie-twinkle motion-reduce:animate-none"
            style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.duration}s` }}
          />
        ))}
      </svg>
      {/* faint nebula haze so the sky isn't flat black */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(157,254,10,0.06),transparent_40%),radial-gradient(circle_at_80%_30%,rgba(157,254,10,0.04),transparent_35%)]" />
    </div>
  );
}

// Mouth slot geometry as fractions of the rig image, from the call-bot's
// plate table (robot_avatar.py, plate "b" — the one she uses on calls), checked against the pixels.
const MOUTH = { cx: 0.5, cy: 0.59, w: 0.085, h: 0.045 };
const BAR_GAIN = [0.55, 0.85, 1, 0.85, 0.55];

interface SallieRigProps {
  /** Faster, brighter aura while Sallie is composing a reply. */
  busy?: boolean;
  className?: string;
  priority?: boolean;
}

/** The robot rig with its breathing aura and voice-driven mouth. Size and anchoring via className. */
export function SallieRig({ busy = false, className, priority = false }: SallieRigProps) {
  const mouthRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeMouth((level) => {
      mouthRef.current?.style.setProperty('--sallie-mouth', level.toFixed(3));
    });
  }, []);

  return (
    <div className={cn('relative flex items-end justify-center', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-1/2 top-[38%] h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/30 blur-3xl motion-reduce:animate-none',
          busy ? 'animate-sallie-aura-busy' : 'animate-sallie-aura'
        )}
      />
      <div className="relative h-full">
        <Image
          src="/images/sallie-rig-b.webp"
          alt="Sallie, KnowAll's robot sales agent"
          width={900}
          height={601}
          priority={priority}
          className="h-full w-auto max-w-none select-none object-contain object-bottom drop-shadow-[0_0_24px_rgba(157,254,10,0.25)]"
        />
        <div
          ref={mouthRef}
          aria-hidden="true"
          className="pointer-events-none absolute flex items-center justify-center gap-[6%] rounded-[30%] bg-[#0b100d] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)] [--sallie-mouth:0]"
          style={{
            left: `${(MOUTH.cx - MOUTH.w / 2) * 100}%`,
            top: `${(MOUTH.cy - MOUTH.h / 2) * 100}%`,
            width: `${MOUTH.w * 100}%`,
            height: `${MOUTH.h * 100}%`,
          }}
        >
          {BAR_GAIN.map((gain, i) => (
            <span
              key={i}
              className="h-[72%] w-[9%] origin-center rounded-full bg-lime-400 shadow-[0_0_6px_rgba(157,254,10,0.9)] transition-transform duration-75 ease-out"
              style={{
                transform: `scaleY(calc(0.12 + var(--sallie-mouth) * ${gain} * 0.88))`,
                opacity: `calc(0.12 + var(--sallie-mouth) * 0.88)`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface SallieStageProps {
  shape?: 'circle' | 'wide';
  busy?: boolean;
  className?: string;
  priority?: boolean;
}

/** Starfield + rig composed into one framed stage. */
export default function SallieStage({
  shape = 'circle',
  busy = false,
  className,
  priority = false,
}: SallieStageProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden',
        shape === 'circle' && 'aspect-square rounded-full',
        className
      )}
    >
      <Starfield />
      <SallieRig
        busy={busy}
        priority={priority}
        className={cn(
          'absolute inset-x-0',
          // Her eyes sit 43% down the rig; 118% tall with a -1% top puts them dead centre.
          shape === 'circle' ? 'top-[-1%] h-[118%] items-start' : 'bottom-0 h-[96%]'
        )}
      />
    </div>
  );
}
