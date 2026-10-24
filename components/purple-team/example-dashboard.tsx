'use client';

import { useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, ShieldAlert } from 'lucide-react';

// Illustrative figures for a client a few months into the programme. The
// badge on the card says so; nothing here is real client data.
const SCORE = 82;
const TREND = [
  { month: 'May', score: 54 },
  { month: 'Jun', score: 61 },
  { month: 'Jul', score: 66 },
  { month: 'Aug', score: 72 },
  { month: 'Sep', score: 78 },
  { month: 'Oct', score: 82 },
];
// Reserved status colours, each shipped with an icon and label.
const SEVERITY = [
  { label: 'Critical', count: 0, color: '#d03b3b', Icon: AlertOctagon },
  { label: 'High', count: 3, color: '#ec835a', Icon: ShieldAlert },
  { label: 'Medium', count: 11, color: '#fab219', Icon: AlertTriangle },
  { label: 'Low', count: 24, color: '#9ca3af', Icon: Info },
];
const KPIS = [
  { label: 'Mean time to fix', value: '3.2 days' },
  { label: 'Attacks detected', value: '87%' },
  { label: 'Fixes merged', value: '46' },
];
const PURPLE = '#9085e9';

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 128 128"
      className="h-36 w-36"
      role="img"
      aria-label={`Security score ${score} out of 100`}
    >
      <circle cx="64" cy="64" r={r} fill="none" stroke="#1f2937" strokeWidth="12" />
      <circle
        cx="64"
        cy="64"
        r={r}
        fill="none"
        stroke={PURPLE}
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform="rotate(-90 64 64)"
      />
      <text x="64" y="66" textAnchor="middle" fontSize="34" fontWeight="700" fill="#f9fafb">
        {score}
      </text>
      <text x="64" y="86" textAnchor="middle" fontSize="11" fill="#9ca3af">
        out of 100
      </text>
    </svg>
  );
}

function ScoreTrend() {
  const [active, setActive] = useState<number | null>(null);
  const W = 320;
  const H = 120;
  const P = { t: 12, r: 12, b: 22, l: 12 };
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (TREND.length - 1);
  const y = (v: number) => P.t + (1 - (v - 40) / 60) * (H - P.t - P.b);
  const line = TREND.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.score)}`).join(' ');

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="group"
        aria-label="Security score by month, rising from 54 in May to 82 in October"
      >
        <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} stroke="#374151" />
        {active !== null && (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={P.t}
            y2={H - P.b}
            stroke="#6b7280"
            strokeDasharray="2 3"
          />
        )}
        <path d={line} fill="none" stroke={PURPLE} strokeWidth="2" strokeLinejoin="round" />
        {TREND.map((d, i) => (
          <g
            key={d.month}
            tabIndex={0}
            role="img"
            aria-label={`${d.month}: score ${d.score}`}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="outline-none"
          >
            <rect x={x(i) - 20} y={0} width={40} height={H} fill="transparent" />
            <circle
              cx={x(i)}
              cy={y(d.score)}
              r={active === i ? 5 : 4}
              fill={PURPLE}
              stroke="#111827"
              strokeWidth="2"
            />
            <text x={x(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#9ca3af">
              {d.month}
            </text>
          </g>
        ))}
      </svg>
      {active !== null && (
        <div
          className="pointer-events-none absolute rounded-md border border-gray-700 bg-gray-900/95 px-2.5 py-1.5 text-xs shadow-lg"
          style={{ left: `${(x(active) / W) * 100}%`, top: 0, transform: 'translate(-50%, -100%)' }}
          aria-hidden="true"
        >
          <span className="font-semibold text-white">{TREND[active].month}</span>{' '}
          <span className="text-gray-300">score {TREND[active].score}</span>
        </div>
      )}
    </div>
  );
}

function SeverityBars() {
  const max = Math.max(...SEVERITY.map((s) => s.count), 1);
  return (
    <ul className="space-y-2.5" aria-label="Open findings by severity">
      {SEVERITY.map(({ label, count, color, Icon }) => (
        <li
          key={label}
          className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-3 text-sm"
          title={`${label}: ${count} open`}
        >
          <span className="flex items-center gap-1.5 text-gray-300">
            <Icon className="h-4 w-4" style={{ color }} aria-hidden="true" />
            {label}
          </span>
          <span className="h-2.5 rounded-full bg-gray-800">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${(count / max) * 100}%`,
                backgroundColor: color,
                minWidth: count ? 6 : 0,
              }}
            />
          </span>
          <span className="text-right tabular-nums text-gray-200">{count}</span>
        </li>
      ))}
    </ul>
  );
}

/** A mock of the client's Purple Team Portal home: score, trend, open findings, KPIs. */
export default function ExampleDashboard() {
  return (
    <div className="rounded-2xl border border-violet-500/30 bg-gray-900/80 p-6 shadow-2xl shadow-violet-500/10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-gray-400">Purple Team Portal</p>
          <h3 className="text-xl font-semibold text-white">Your security score</h3>
        </div>
        <span className="rounded-full border border-gray-600 px-3 py-1 text-xs uppercase tracking-wide text-gray-300">
          Example
        </span>
      </div>

      <div className="grid gap-8 md:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-center gap-2">
          <ScoreRing score={SCORE} />
          <p className="text-sm text-gray-400">
            <span className="font-semibold text-white">+28</span> in six months
          </p>
        </div>
        <div className="space-y-6">
          <div>
            <p className="mb-2 text-sm font-medium text-gray-300">Score by month</p>
            <ScoreTrend />
          </div>
          <div>
            <p className="mb-3 text-sm font-medium text-gray-300">Open findings</p>
            <SeverityBars />
          </div>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-3 border-t border-gray-800 pt-6">
        {KPIS.map((k) => (
          <div key={k.label} className="text-center">
            <dt className="text-xs text-gray-400">{k.label}</dt>
            <dd className="mt-1 text-2xl font-bold text-white">{k.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
