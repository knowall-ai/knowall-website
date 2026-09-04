import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * Sallie's animated avatar, in the house style for KnowAll agents: a static
 * robot rig over a backdrop that carries all the motion. Stars twinkle and
 * drift very slowly, and a lime aura behind her "breathes" — faster while she
 * is thinking. Nothing on the rig itself moves (no lip-sync, no blinking), and
 * every animation is switched off under `prefers-reduced-motion`.
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

interface SallieRigProps {
  /** Faster, brighter aura while Sallie is composing a reply. */
  busy?: boolean;
  className?: string;
  priority?: boolean;
}

/** The robot rig with its breathing aura. Bottom-anchored; size via className. */
export function SallieRig({ busy = false, className, priority = false }: SallieRigProps) {
  return (
    <div className={cn('relative flex items-end justify-center', className)}>
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute left-1/2 top-[38%] h-[70%] w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-lime-400/30 blur-3xl motion-reduce:animate-none',
          busy ? 'animate-sallie-aura-busy' : 'animate-sallie-aura'
        )}
      />
      <Image
        src="/images/sallie-rig.webp"
        alt="Sallie, KnowAll's robot sales agent"
        width={900}
        height={683}
        priority={priority}
        className="relative h-full w-auto max-w-none select-none object-contain object-bottom drop-shadow-[0_0_24px_rgba(157,254,10,0.25)]"
      />
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
          'absolute inset-x-0 bottom-0',
          shape === 'circle' ? 'h-[88%] translate-y-[4%]' : 'h-[96%]'
        )}
      />
    </div>
  );
}
