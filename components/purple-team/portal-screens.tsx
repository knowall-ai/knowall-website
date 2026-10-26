'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/**
 * The portal's real screens (DEMO_MODE, the fictional Contoso), the same set as the deck's.
 * `description` is the image's text equivalent: what the screen shows, not its caption.
 */
export const PORTAL_SCREENS = [
  {
    file: 'portal-overview',
    description:
      "Three desk cards show what Pennie, Ollie and Poppie are each working on and their hours this month; below, a Waiting on you strip of approvals with Approve and Comment buttons, then Poppie's briefing and a security score gauge.",
    name: 'Overview',
    caption: "The team right now, what's waiting on you, Poppie's briefing and your security score",
  },
  {
    file: 'portal-cases',
    description:
      'Filters by status, priority and source above an Open the longest bar chart of how long each case has been open, then a list of cases, each with a priority score out of 100, severity, exploit and EPSS tags, and the repositories it affects.',
    name: 'Cases',
    caption: "Every vulnerability that affects you, scored, with Poppie's recommendation",
  },
  {
    file: 'portal-case',
    description:
      "A Next.js middleware flaw scored 95 out of 100, its progress from Found to Done, a Review the fix PR button, Pennie's write-up with her Affected verdict and evidence, and the reasons behind the score.",
    name: 'Case detail',
    caption: "Pennie's verdict and evidence, Ollie's fix, and where it stands",
  },
  {
    file: 'portal-repos',
    description:
      'Repository cards grouped by organisation and project, each with its open findings by severity and which scanning features are on, with filters by source, organisation, project and name.',
    name: 'Repositories',
    caption: 'Each repository by organisation and project, its open findings and its scanning',
  },
  {
    file: 'portal-repo',
    description:
      "One repository's open findings by severity, the team's recommendations (upgrades that clear findings, each with a button to ask the team), and approvals waiting on you.",
    name: 'Repository',
    caption: "The team's recommendations for one repository, with a button to set them going",
  },
  {
    file: 'portal-app',
    description:
      'One Azure web app: the repository it deploys from, its hostnames, six checks with two failing (WAF in Detection mode, origin not locked to Front Door), its Front Door and WAF settings, and Defender for Cloud alerts and recommendations.',
    name: 'Web app',
    caption: 'Each Azure web app: its repository, Front Door and WAF, and Defender for Cloud',
  },
  {
    file: 'portal-owasp',
    description:
      'The OWASP Top 10 checklist for one application: each item marked Not assessed, Pass or Gap, with who checks it and a note of the evidence.',
    name: 'OWASP checklists',
    caption: "The OWASP Top 10 and LLM Top 10, item by item, with Pennie's results",
  },
  {
    file: 'portal-usage',
    description:
      "Approvals Poppie paused for budget, the hours left in the CISP block, burn rate and this month's hours, and a 30-day chart of the block running down.",
    name: 'Usage and hours',
    caption: 'Time spent per case, by agent and by job, against your plan',
  },
] as const;

const src = (file: string) => `/presentations/images/${file}.jpg`;

/**
 * The portal, screen by screen: one large screenshot with its caption, and a row of
 * thumbnails to choose from (a tab list, so arrow keys move between screens). No autoplay.
 */
export default function PortalScreens() {
  const [active, setActive] = useState(0);
  const screen = PORTAL_SCREENS[active];
  const move = (to: number) => {
    const next = (to + PORTAL_SCREENS.length) % PORTAL_SCREENS.length;
    setActive(next);
    document.getElementById(`portal-tab-${next}`)?.focus();
  };

  return (
    <div>
      <figure
        id="portal-panel"
        role="tabpanel"
        aria-labelledby={`portal-tab-${active}`}
        className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl shadow-violet-950/40"
      >
        <a href={src(screen.file)} target="_blank" rel="noopener noreferrer" className="block">
          <Image
            src={src(screen.file)}
            alt={`Purple Team Portal, ${screen.name} screen, example data: ${screen.description}`}
            width={1440}
            height={800}
            sizes="(min-width: 1152px) 1152px, 100vw"
            className="h-auto w-full"
            priority={active === 0}
          />
        </a>
        <figcaption className="border-t border-gray-800 px-5 py-4 text-gray-300">
          <strong className="text-white">{screen.name}</strong> &middot; {screen.caption}
          <span className="ml-2 rounded-full border border-violet-500/40 px-2 py-0.5 text-xs text-violet-300">
            Example data
          </span>
        </figcaption>
      </figure>

      <div
        role="tablist"
        aria-label="Portal screens"
        className="mt-4 grid grid-cols-4 gap-3 md:grid-cols-8"
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight') move(active + 1);
          if (e.key === 'ArrowLeft') move(active - 1);
        }}
      >
        {PORTAL_SCREENS.map((s, i) => (
          <button
            key={s.file}
            id={`portal-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls="portal-panel"
            tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)}
            className={cn(
              'group text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              i === active ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            )}
          >
            <span
              className={cn(
                'block overflow-hidden rounded-lg border transition-colors',
                i === active ? 'border-brand' : 'border-gray-800 group-hover:border-gray-600'
              )}
            >
              <Image
                src={src(s.file)}
                alt=""
                width={1440}
                height={800}
                sizes="160px"
                className={cn(
                  'h-auto w-full',
                  i === active ? '' : 'opacity-70 group-hover:opacity-100'
                )}
              />
            </span>
            <span className="mt-1.5 block text-xs font-medium">{s.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
