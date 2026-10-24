import type { Metadata } from 'next';
import Image from 'next/image';
import { Check, ScanSearch } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import SallieAssistant from '@/components/sallie-assistant';
import CveTrendChart from '@/components/purple-team/cve-trend-chart';
import ExampleDashboard from '@/components/purple-team/example-dashboard';
import EnquiryForm from '@/components/purple-team/enquiry-form';
import {
  CVES_PER_YEAR,
  KEV_ADDED_LAST_YEAR,
  CVES_LAST_30_DAYS,
  CVES_AS_OF,
} from '@/components/purple-team/data';

export const metadata: Metadata = {
  title: 'Purple Team | KnowAll AI',
  description:
    'AI agents that attack, defend and fix your software around the clock. Pennie the Pen Tester (red team), Ollie the Operator (blue team) and Poppie the Planner, on GitHub and Azure DevOps.',
};

const steps = [
  {
    image: '/images/purple-team/pennie-attack.jpg',
    alt: 'Pennie, the red robot, picking a glowing red holographic padlock on a server rack',
    title: 'Pennie attacks',
    text: 'With your written authorisation, Pennie probes your apps, APIs and cloud, and checks every new CVE against your code to prove what is really exploitable.',
    accent: 'bg-red-500',
  },
  {
    image: '/images/purple-team/ollie-defend.jpg',
    alt: 'Ollie, the blue robot, raising a glowing hexagonal shield against red shards',
    title: 'Ollie defends',
    text: 'Did Ollie see it? He watches Microsoft Defender for Cloud and Sentinel 24/7, and every attack he missed becomes a new detection.',
    accent: 'bg-blue-500',
  },
  {
    image: '/images/purple-team/ollie-fix.jpg',
    alt: 'Ollie, the blue robot, sealing a crack in a glowing panel of code',
    title: 'Ollie fixes',
    text: 'He opens a pull request with the fix and a test that proves it. Your developers review and merge, then Pennie attacks again to confirm it holds.',
    accent: 'bg-blue-500',
  },
  {
    image: '/images/purple-team/poppie-report.jpg',
    alt: 'Poppie, the copper robot, holding a tablet projecting a locked blue padlock and a rising chart',
    title: 'Poppie reports',
    text: 'Poppie scopes the work, tracks every finding as a risk, issue or task, and shows your score, time to detect and time to fix each month.',
    accent: 'bg-violet-500',
  },
];

const team = [
  {
    name: 'Pennie the Pen Tester',
    team: 'Red team',
    dot: 'bg-red-500',
    text: 'Attacks like a real adversary, mapped to the OWASP Top 10, the OWASP LLM Top 10 and MITRE ATT&CK.',
  },
  {
    name: 'Ollie the Operator',
    team: 'Blue team',
    dot: 'bg-blue-500',
    text: 'Filters the daily CVE flood down to what affects you using CISA KEV and EPSS, then defends and patches.',
  },
  {
    name: 'Poppie the Planner',
    team: 'Purple lead',
    dot: 'bg-violet-500',
    text: 'Runs the attack, detect and fix loop between them, so red and blue work as one team.',
  },
];

const standards = [
  { name: 'CVE & NVD', text: 'The public register of known vulnerabilities' },
  { name: 'CVSS', text: 'How severe each one is, 0 to 10' },
  { name: 'CISA KEV', text: 'Which ones attackers are exploiting right now' },
  { name: 'EPSS', text: 'How likely one is to be exploited next' },
  { name: 'CWE', text: 'The type of weakness behind each flaw' },
  { name: 'Exploit-DB & GHSA', text: 'Public exploits and open-source advisories' },
  { name: 'OWASP Top 10', text: 'The most critical web-app risks' },
  { name: 'OWASP LLM Top 10', text: 'Prompt injection and other AI-app risks' },
  { name: 'MITRE ATT&CK', text: 'The catalogue of real attacker techniques' },
];

const platforms = [
  'GitHub',
  'Azure DevOps',
  'GitHub Advanced Security',
  'Microsoft Defender for Cloud',
  'Microsoft Sentinel',
  'CodeRabbit',
];

const faqs = [
  {
    q: 'Is it legal to attack our systems?',
    a: 'Only with your written permission. Before Pennie tests anything, we agree the targets, timings and rules of engagement with you in writing. Anything outside that scope is never touched.',
  },
  {
    q: 'Do you need access to our code?',
    a: 'Read access lets us match new vulnerabilities to the exact packages you use, and lets Ollie open fix pull requests. You connect GitHub or Azure DevOps yourself and can revoke access at any time.',
  },
  {
    q: 'Will the agents change our code without asking?',
    a: 'No. Every fix arrives as a pull request with a test that proves it. Your developers review and merge it, with a CodeRabbit review alongside.',
  },
  {
    q: 'Could testing break production?',
    a: 'Destructive tests are off by default. We agree what can run against production and what only runs against a staging copy, and schedule anything risky with you.',
  },
  {
    q: 'We use GitHub. Or Azure DevOps. Or both.',
    a: 'All three work. On Azure DevOps we use GitHub Advanced Security for Azure DevOps; on GitHub, its built-in Dependabot, code scanning and secret scanning.',
  },
  {
    q: 'What do we get each month?',
    a: 'Access to your Purple Team Portal with your security score, every advisory that touches your code and what we did about it, plus a monthly report from Poppie.',
  },
];

const fmt = (n: number) => n.toLocaleString('en-GB');

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
      {children}
    </p>
  );
}

function Quote({ text, by, tint }: { text: string; by: string; tint: string }) {
  return (
    <section className={`px-4 py-20 ${tint}`}>
      <figure className="container mx-auto max-w-4xl text-center">
        <blockquote className="text-3xl font-bold leading-tight md:text-5xl">
          &ldquo;{text}&rdquo;
        </blockquote>
        <figcaption className="mt-6 text-sm uppercase tracking-[0.25em] text-gray-400">
          {by}
        </figcaption>
      </figure>
    </section>
  );
}

export default function PurpleTeamPage() {
  const perDay = Math.round(CVES_LAST_30_DAYS / 30);

  return (
    <main className="flex min-h-screen flex-col bg-gray-950 text-white">
      <Header />

      {/* Full-bleed hero: the team fills the right, the headline sits on the dark left */}
      <section className="relative isolate flex min-h-[560px] items-center overflow-hidden md:min-h-[680px]">
        <Image
          src="/images/purple-team/hero.jpg"
          alt="Pennie the red-team robot, Poppie the copper planner robot and Ollie the blue-team robot"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[70%_center]"
        />
        <div
          className="absolute inset-0 -z-10 bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent md:via-gray-950/40"
          aria-hidden="true"
        />
        {/* On small screens the team sits behind the headline, so dim it further. */}
        <div className="absolute inset-0 -z-10 bg-gray-950/60 md:hidden" aria-hidden="true" />
        <div
          className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-gray-950 to-transparent"
          aria-hidden="true"
        />
        <div className="container mx-auto max-w-6xl px-4 py-16">
          <div className="max-w-xl">
            <Eyebrow>Continuous security, by AI agents</Eyebrow>
            <h1 className="mb-6 text-5xl font-bold leading-[1.05] md:text-7xl">
              Break it
              <br />
              before <span className="text-red-400">they</span> do.
            </h1>
            <p className="mb-8 text-xl text-white/90">
              Attackers now use AI to find holes around the clock. So does the KnowAll{' '}
              <span className="font-semibold text-red-400">Pur</span>
              <span className="font-semibold text-violet-400">ple</span>{' '}
              <span className="font-semibold text-blue-400">Team</span>: Pennie attacks, Ollie
              defends and fixes, and Poppie runs the loop between them.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button
                asChild
                size="lg"
                className="bg-violet-600 text-white shadow-lg shadow-violet-500/30 hover:bg-violet-700"
              >
                <a href="#enquire">Talk to the Purple Team</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white bg-transparent text-white hover:bg-white/10"
              >
                <a href="#how-it-works">How it works</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* The problem, in three numbers */}
      <section className="border-y border-gray-800 bg-gray-900 px-4 py-12">
        <dl className="container mx-auto grid max-w-6xl gap-8 text-center sm:grid-cols-3">
          <div className="flex flex-col-reverse">
            <dt className="mt-2 text-gray-400">new CVEs published every day</dt>
            <dd className="text-4xl font-bold text-white md:text-5xl">{fmt(perDay)}</dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt className="mt-2 text-gray-400">added to CISA&apos;s exploited list last year</dt>
            <dd className="text-4xl font-bold text-white md:text-5xl">
              {fmt(KEV_ADDED_LAST_YEAR)}
            </dd>
          </div>
          <div className="flex flex-col-reverse">
            <dt className="mt-2 text-gray-400">agents on watch, 24/7</dt>
            <dd className="text-4xl font-bold text-white md:text-5xl">3</dd>
          </div>
        </dl>
        <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-gray-400">
          No person can read every advisory. The skill is knowing which handful affect <em>your</em>{' '}
          code and are being exploited, and fixing those first.
        </p>
      </section>

      {/* How it works: big illustrated steps */}
      <section id="how-it-works" className="px-4 py-24">
        <div className="container mx-auto max-w-6xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mb-4 max-w-3xl text-4xl font-bold md:text-5xl">
            Attack. Defend. Fix. Report. Repeat.
          </h2>
          <p className="mb-12 max-w-2xl text-lg text-gray-300">
            A loop that never stops, because neither do the attackers.
          </p>
          <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s, i) => (
              <li
                key={s.title}
                className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900"
              >
                <Image
                  src={s.image}
                  alt={s.alt}
                  width={1024}
                  height={1024}
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="aspect-square w-full object-cover"
                />
                <div className="p-6">
                  <h3 className="mb-2 flex items-center gap-3 text-lg font-semibold">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-white ${s.accent}`}
                    >
                      {i + 1}
                    </span>
                    {s.title}
                  </h3>
                  <p className="text-gray-300">{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Quote
        text="Most pen tests end with a PDF. Ours end with merged fixes."
        by="Poppie the Planner"
        tint="bg-gradient-to-r from-red-950/40 via-violet-950/60 to-blue-950/40"
      />

      {/* Meet the team: big image beside a checklist */}
      <section id="team" className="px-4 py-24">
        <div className="container mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
          <div>
            <Eyebrow>Meet the team</Eyebrow>
            <h2 className="mb-6 text-4xl font-bold md:text-5xl">
              Red attacks. Blue defends. Purple makes them one team.
            </h2>
            <ul className="space-y-6">
              {team.map((a) => (
                <li key={a.name} className="flex gap-4">
                  <span
                    className={`mt-2 h-3 w-3 shrink-0 rounded-full ${a.dot}`}
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-semibold">
                      {a.name} <span className="font-normal text-gray-400">· {a.team}</span>
                    </p>
                    <p className="text-gray-300">{a.text}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-8 flex items-center gap-2 text-gray-300">
              <Check className="h-5 w-5 shrink-0 text-violet-400" aria-hidden="true" />
              Works in your GitHub or Azure DevOps, and every change goes through your own review.
            </p>
          </div>
          <div className="relative">
            <div
              className="absolute -inset-6 rounded-3xl bg-violet-500/20 blur-3xl"
              aria-hidden="true"
            />
            <Image
              src="/images/purple-team/team.jpg"
              alt="Pennie, Poppie and Ollie side by side, lit red, purple and blue"
              width={1536}
              height={1024}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="relative rounded-2xl border border-violet-500/30 shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Charts */}
      <section id="numbers" className="bg-gray-900 px-4 py-24">
        <div className="container mx-auto max-w-6xl">
          <Eyebrow>The numbers</Eyebrow>
          <h2 className="mb-12 max-w-3xl text-4xl font-bold md:text-5xl">
            A flood of advisories. A handful that matter.
          </h2>
          <div className="grid gap-10 lg:grid-cols-2">
            <div className="flex flex-col rounded-2xl border border-gray-800 bg-gray-950 p-6">
              <h3 className="text-xl font-semibold">New CVEs published per year</h3>
              <p className="mb-6 text-sm text-gray-400">
                Source: NIST National Vulnerability Database. *Year to date.
              </p>
              <CveTrendChart data={CVES_PER_YEAR} asOf={CVES_AS_OF} />
              <KevCallout />
            </div>
            <div>
              <h3 className="mb-2 text-xl font-semibold">What you see each month</h3>
              <p className="mb-6 text-sm text-gray-400">
                Your own Purple Team Portal tracks every advisory that touches your code, what we
                did about it, and your score over time.
              </p>
              <ExampleDashboard />
            </div>
          </div>
        </div>
      </section>

      <Quote
        text="I break in so nobody else can."
        by="Pennie the Pen Tester"
        tint="bg-gradient-to-r from-red-950/60 to-gray-950"
      />

      {/* Standards & platforms */}
      <section className="px-4 py-24">
        <div className="container mx-auto max-w-6xl">
          <Eyebrow>Built on the standards</Eyebrow>
          <h2 className="mb-4 max-w-3xl text-4xl font-bold md:text-5xl">
            Mapped to the registers your auditors already know.
          </h2>
          <p className="mb-12 max-w-2xl text-lg text-gray-300">
            Every finding carries its public references, so it stands up in an ISO 27001 or Cyber
            Essentials review.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {standards.map((s) => (
              <div
                key={s.name}
                className="flex items-start gap-3 rounded-xl border border-gray-800 bg-gray-900 p-5"
              >
                <ScanSearch
                  className="mt-0.5 h-5 w-5 shrink-0 text-violet-400"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold">{s.name}</h3>
                  <p className="text-sm text-gray-400">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <p className="mb-4 text-xs uppercase tracking-[0.25em] text-gray-400">Works with</p>
            <ul className="flex flex-wrap gap-3">
              {platforms.map((p) => (
                <li
                  key={p}
                  className="rounded-full border border-gray-700 px-4 py-2 text-sm text-gray-200"
                >
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="bg-gray-900 px-4 py-24">
        <div className="container mx-auto max-w-3xl">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mb-10 text-4xl font-bold md:text-5xl">Questions</h2>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="border-gray-800">
                <AccordionTrigger className="text-left text-lg hover:text-violet-300 hover:no-underline">
                  {f.q}
                </AccordionTrigger>
                <AccordionContent className="text-base text-gray-300">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Enquiry */}
      <section id="enquire" className="px-4 py-24">
        <div className="container mx-auto max-w-6xl overflow-hidden rounded-3xl border border-violet-500/30 bg-gradient-to-br from-red-950/30 via-gray-900 to-blue-950/30">
          <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1.3fr] lg:p-14">
            <div>
              <Eyebrow>Get started</Eyebrow>
              <h2 className="mb-4 text-4xl font-bold">
                See how the Purple Team would work for you
              </h2>
              <p className="mb-6 text-lg text-gray-300">
                Tell us a little about your setup. We&apos;ll come back with a scoped plan: what
                Pennie would test, what Ollie would watch, and what your first month&apos;s report
                would show.
              </p>
              <ul className="space-y-3 text-gray-200">
                {[
                  'GitHub or Azure DevOps',
                  'Nothing is tested without written authorisation',
                  'Every fix goes through your own code review',
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-5 w-5 shrink-0 text-violet-400" aria-hidden="true" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-950/80 p-6 sm:p-8">
              <EnquiryForm />
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <SallieAssistant dockOnly />
    </main>
  );
}

/**
 * The needle in the haystack: a year's new CVEs beside the CVEs (from any
 * year) CISA added to its exploited list that year. Different cohorts, so no
 * percentage — just the two numbers side by side.
 */
function KevCallout() {
  const last = CVES_PER_YEAR.filter((d) => !d.partial).at(-1);
  if (!last) return null;
  return (
    <div className="mt-auto grid grid-cols-2 gap-4 border-t border-gray-800 pt-6">
      <div>
        <p className="text-3xl font-bold">{fmt(last.count)}</p>
        <p className="text-sm text-gray-400">new CVEs published in {last.year}</p>
      </div>
      <div>
        <p className="text-3xl font-bold text-red-400">{fmt(KEV_ADDED_LAST_YEAR)}</p>
        <p className="text-sm text-gray-400">
          CVEs CISA confirmed as exploited in the wild in {last.year}. Those are the ones to fix
          first.
        </p>
      </div>
    </div>
  );
}
