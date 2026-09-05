'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { subscribeAudio, type AudioFrame } from '@/components/sallie-voice';

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
// Waveform in the slot, same recipe as her Teams call rig: a sine wave riding
// the live level, windowed so it pins flat at both ends of the slot.
const WAVE_N = 22;
const WAVE_VIEW_W = 100;
const WAVE_VIEW_H = 40;

function wavePoints(level: number, t: number): string {
  const pts: string[] = [];
  const inset = 4;
  for (let k = 0; k <= WAVE_N; k++) {
    const x = inset + (k * (WAVE_VIEW_W - inset * 2)) / WAVE_N;
    const win = Math.sin((Math.PI * k) / WAVE_N);
    const y = WAVE_VIEW_H / 2 + Math.sin(t * 14 + k * 0.7) * level * WAVE_VIEW_H * 0.42 * win;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(' ');
}

interface SallieRigProps {
  /** Faster, brighter aura while Sallie is composing a reply. */
  busy?: boolean;
  className?: string;
  priority?: boolean;
}

/** The robot rig with its breathing aura and voice-driven mouth. Size and anchoring via className. */
export function SallieRig({ busy = false, className, priority = false }: SallieRigProps) {
  const waveRef = useRef<SVGPolylineElement>(null);

  useEffect(() => {
    return subscribeAudio(({ level }) => {
      const el = waveRef.current;
      if (!el) return;
      el.setAttribute('points', wavePoints(level, performance.now() / 1000));
      el.style.opacity = (0.35 + level * 0.65).toFixed(2);
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
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${WAVE_VIEW_W} ${WAVE_VIEW_H}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute overflow-visible"
          style={{
            left: `${(MOUTH.cx - MOUTH.w / 2) * 100}%`,
            top: `${(MOUTH.cy - MOUTH.h / 2) * 100}%`,
            width: `${MOUTH.w * 100}%`,
            height: `${MOUTH.h * 100}%`,
          }}
        >
          <rect
            x="0"
            y="0"
            width={WAVE_VIEW_W}
            height={WAVE_VIEW_H}
            rx={WAVE_VIEW_H / 2}
            fill="rgba(8,12,10,0.92)"
          />
          <polyline
            ref={waveRef}
            points={wavePoints(0, 0)}
            fill="none"
            stroke="#9DFE0A"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            style={{ opacity: 0.35, filter: 'drop-shadow(0 0 1px rgba(157,254,10,0.8))' }}
          />
        </svg>
      </div>
    </div>
  );
}

/**
 * Circular waveform around a stage, after Nod.ie's voice orb: each frame the
 * spectrum is walked around the circle and the radius bulges with each bin,
 * with a slow rotation so it never sits still while she talks. Fades out
 * when she is silent.
 */
function WaveformRing({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let alpha = 0;
    let lastFrame: AudioFrame | null = null;
    let raf = 0;
    // The bulge is feedback for her voice and stays; only the decorative spin is dropped.
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const draw = () => {
      raf = 0;
      const dpr = window.devicePixelRatio || 1;
      const size = canvas.clientWidth;
      if (canvas.width !== size * dpr) {
        canvas.width = size * dpr;
        canvas.height = size * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const frame = lastFrame ?? { level: 0, bins: new Uint8Array(64) };
      // Ease the ring in and out so it doesn't pop.
      alpha += ((frame.level > 0.02 ? 1 : 0) - alpha) * 0.15;
      if (alpha < 0.01) return;

      const c = size / 2;
      // The circle is 2/3 of this canvas, so its rim is at 1/3 — the wave
      // starts exactly on the rim and the band between rim and wave is filled.
      const base = size / 3;
      const reach = size * 0.15;
      const rotation = reduceMotion ? 0 : ((performance.now() % 10000) / 10000) * Math.PI * 2;
      const n = frame.bins.length;
      const loop = new Path2D();
      for (let i = 0; i <= 120; i++) {
        const angle = (i / 120) * Math.PI * 2 + rotation;
        // Walk the spectrum up and down four times around the loop so it
        // stays symmetric (bass lobes at 0° and 180°) and closes smoothly.
        const seg = Math.floor(i / 30) % 4;
        const pos = (i % 30) / 30;
        const idx = Math.floor((seg % 2 === 0 ? pos : 1 - pos) * (n - 1));
        const amp = frame.bins[idx] / 255;
        const r = base + amp * reach * (0.4 + 0.6 * frame.level);
        const x = c + r * Math.cos(angle);
        const y = c + r * Math.sin(angle);
        if (i === 0) loop.moveTo(x, y);
        else loop.lineTo(x, y);
      }
      loop.closePath();
      // Fill rim → wave (the loop minus the circle), then edge the wave.
      const band = new Path2D(loop);
      band.arc(c, c, base, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(157, 254, 10, ${(0.55 * alpha).toFixed(3)})`;
      ctx.fill(band, 'evenodd');
      ctx.lineWidth = 2;
      ctx.strokeStyle = `rgba(157, 254, 10, ${(0.95 * alpha).toFixed(3)})`;
      ctx.shadowColor = 'rgba(157, 254, 10, 0.9)';
      ctx.shadowBlur = 10;
      ctx.stroke(loop);
      if (alpha < 0.99 || frame.level > 0) raf = requestAnimationFrame(draw);
    };

    const unsubscribe = subscribeAudio((frame) => {
      lastFrame = frame;
      if (!raf) raf = requestAnimationFrame(draw);
    });
    return () => {
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn('pointer-events-none absolute -inset-[25%] h-[150%] w-[150%]', className)}
    />
  );
}

interface SallieStageProps {
  shape?: 'circle' | 'wide';
  busy?: boolean;
  /** Sizing and positioning of the whole stage. */
  className?: string;
  /** Ring / shadow classes for the clipped frame itself. */
  frameClassName?: string;
  priority?: boolean;
  /** Draw the voice waveform around a circular stage. */
  waveform?: boolean;
}

/** Starfield + rig composed into one framed stage. */
export default function SallieStage({
  shape = 'circle',
  busy = false,
  className,
  frameClassName,
  priority = false,
  waveform = false,
}: SallieStageProps) {
  const frame = (
    <div
      className={cn(
        'relative overflow-hidden',
        shape === 'circle' ? 'aspect-square rounded-full' : 'h-full w-full',
        shape === 'circle' && waveform ? '' : className,
        frameClassName
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
  if (shape !== 'circle' || !waveform) return frame;
  return (
    <div className={cn('relative', className)}>
      {frame}
      <WaveformRing />
    </div>
  );
}
