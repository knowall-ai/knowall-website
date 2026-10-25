import type React from 'react';
import Image from 'next/image';
import MotionScope from '@/components/home/motion-scope';

/*
 * Traces in the die-city plate (image space, 1536 x 1024) that carry light.
 * Each one starts or ends at a robot, so data visibly arrives at an agent
 * and value leaves one. Paths stop short of the robots' bodies, so nothing
 * runs across them.
 */
type Pulse = { d: string; tone: 'signal' | 'value'; dur: number; delay: number; width: number };

const PULSES: Pulse[] = [
  // Down the main avenue into Sallie
  { d: 'M400 232 L932 432', tone: 'signal', dur: 5.2, delay: 0, width: 5 },
  // Out of focus foreground bus, rising towards the team
  { d: 'M250 1024 L1150 660', tone: 'signal', dur: 6.8, delay: -2.4, width: 9 },
  // Value leaving Zaplie, along the avenue and down the side street
  { d: 'M1320 576 L1536 657', tone: 'value', dur: 3.6, delay: -1.2, width: 5 },
  { d: 'M1200 638 L1536 836', tone: 'value', dur: 4.4, delay: -3, width: 6 },
  // The far ring road, soft in the haze
  { d: 'M880 112 L1536 212', tone: 'signal', dur: 7.5, delay: -5, width: 3 },
];

/* Visor glows that breathe over the robots' eyes in the plate. */
// Sallie's flares in time with the avenue pulse reaching her (same 5.2s cycle).
const EYES = [
  { cx: 972, cy: 404, rx: 34, ry: 18, fill: 'url(#die-eye-signal)', kind: 'arrive', delay: 0 },
  { cx: 1103, cy: 432, rx: 30, ry: 16, fill: 'url(#die-eye-ollie)', kind: 'breathe', delay: -1.8 },
  { cx: 1238, cy: 468, rx: 34, ry: 17, fill: 'url(#die-eye-value)', kind: 'breathe', delay: -4 },
];

const BOKEH = [
  { className: 'left-[6%] bottom-[-6%] h-56 w-56 bg-brand/25', speed: 1.6 },
  { className: 'left-[38%] bottom-[-12%] h-72 w-72 bg-[#f7931a]/15', speed: 2.2 },
  { className: 'right-[4%] bottom-[2%] h-40 w-40 bg-[#f7931a]/20', speed: 1.3 },
];

/**
 * The home hero: a macro shot of a silicon die lit like a city at night,
 * where KnowAll's agents walk the circuit streets. Light pulses ride the
 * traces on an SVG layer that shares the image's box (so it stays aligned at
 * every crop), the camera drifts slowly, and the scene parallaxes on scroll.
 */
export default function DieHero({ children }: { children: React.ReactNode }) {
  return (
    <MotionScope
      parallax
      className="die-hero relative isolate overflow-hidden bg-[#040605] md:h-[calc(100svh-73px)] md:min-h-[620px] md:max-h-[1080px]"
    >
      {/* Phones: the scene sits above the copy, short enough that the headline and
          buttons show on the first screen. Wider: it fills the hero behind it. */}
      <div className="relative h-[32svh] min-h-[240px] overflow-hidden [container-type:size] md:absolute md:inset-0 md:h-auto">
        <div className="die-stage">
          <div className="die-camera absolute inset-0">
            <Image
              src="/images/home/die-city.webp"
              alt="Macro view of a processor die lit up like a city at night, where three KnowAll robots, Sallie, Ollie and Zaplie, walk along a copper trace as green data and orange value pulse through the circuits"
              fill
              loading="eager"
              fetchPriority="high"
              quality={90}
              // Phones: the stage is twice the scene's height (32svh) wide, at least
              // the viewport. Wider: it covers the hero, so tall screens crop the sides.
              sizes="(max-width: 767px) max(100vw, 64vh), (max-aspect-ratio: 3/2) 150vh, 100vw"
              className="object-cover"
            />
            <svg
              className="absolute inset-0 h-full w-full mix-blend-screen"
              viewBox="0 0 1536 1024"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <radialGradient id="die-eye-signal">
                  <stop offset="0" stopColor="#d8ff8a" stopOpacity="0.95" />
                  <stop
                    offset="0.45"
                    className="[stop-color:var(--color-brand)]"
                    stopOpacity="0.45"
                  />
                  <stop offset="1" className="[stop-color:var(--color-brand)]" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="die-eye-ollie">
                  <stop offset="0" stopColor="#c8fbff" stopOpacity="0.9" />
                  <stop offset="0.45" stopColor="#38d9f5" stopOpacity="0.4" />
                  <stop offset="1" stopColor="#38d9f5" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="die-eye-value">
                  <stop offset="0" stopColor="#ffd9a0" stopOpacity="0.95" />
                  <stop offset="0.45" stopColor="#f7931a" stopOpacity="0.45" />
                  <stop offset="1" stopColor="#f7931a" stopOpacity="0" />
                </radialGradient>
              </defs>
              {PULSES.map((p) => (
                <g
                  key={p.d}
                  className="die-pulse"
                  data-tone={p.tone}
                  style={
                    {
                      '--dur': `${p.dur}s`,
                      '--delay': `${p.delay}s`,
                    } as React.CSSProperties
                  }
                >
                  <path d={p.d} pathLength={100} strokeWidth={p.width * 4} opacity={0.18} />
                  <path d={p.d} pathLength={100} strokeWidth={p.width * 1.8} opacity={0.5} />
                  <path d={p.d} pathLength={100} strokeWidth={p.width * 0.6} className="die-core" />
                </g>
              ))}
              {EYES.map((e) => (
                <ellipse
                  key={e.cx}
                  className="die-eye"
                  data-kind={e.kind}
                  cx={e.cx}
                  cy={e.cy}
                  rx={e.rx}
                  ry={e.ry}
                  fill={e.fill}
                  style={{ animationDelay: `${e.delay}s` }}
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Out-of-focus foreground lights, closer to the lens than the die */}
        {BOKEH.map((b) => (
          <span
            key={b.className}
            aria-hidden="true"
            className={`die-bokeh pointer-events-none absolute rounded-full blur-3xl ${b.className}`}
            style={{ '--speed': b.speed } as React.CSSProperties}
          />
        ))}

        {/* Shade for the headline: down the left on wide screens, the foot on phones */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,#040605_0%,rgba(4,6,5,0)_32%)] md:bg-[linear-gradient(to_right,rgba(4,6,5,0.9)_0%,rgba(4,6,5,0.55)_38%,rgba(4,6,5,0)_62%),linear-gradient(to_top,#040605_0%,rgba(4,6,5,0)_30%)]"
        />
      </div>

      <div className="die-copy relative z-10 -mt-10 md:mt-0 md:flex md:h-full md:items-center">
        <div className="mx-auto w-full max-w-6xl px-5 pb-14 md:px-8 md:pb-0">{children}</div>
      </div>
    </MotionScope>
  );
}
