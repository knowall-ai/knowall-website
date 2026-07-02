import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { BookOpen, Bot, Github, Zap } from 'lucide-react';
import Header from '@/components/header';
import Footer from '@/components/footer';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Our Story | KnowAll AI',
  description:
    'The story of KnowAll AI — custom Microsoft Copilots, multi-agent AI teams, and Bitcoin-powered value-for-value systems, founded by Ben Weeks.',
};

const COMPANY_NPUB = 'npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar';

export default function StoryPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gray-950">
      <Header />

      {/* Profile hero — the company's Nostr banner, avatar, name, and about. */}
      <div>
        <div className="relative h-40 w-full sm:h-56 lg:h-72 xl:h-80 bg-gradient-to-r from-lime-900/40 via-gray-900 to-gray-800">
          <Image
            src="/images/knowall-nostr-banner.png"
            alt="KnowAll AI banner"
            fill
            priority
            className="object-cover"
          />
        </div>

        <div className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Avatar overlaps the banner, profile-style. */}
          <div className="-mt-12 sm:-mt-14">
            <Image
              src="/images/knowall-nostr-avatar.png"
              alt="KnowAll AI logo"
              width={112}
              height={112}
              className="h-24 w-24 sm:h-28 sm:w-28 rounded-full border-4 border-gray-950 bg-gray-900 shadow-md"
            />
          </div>

          <div className="mt-3">
            <h1 className="text-2xl sm:text-3xl font-bold text-white">KnowAll AI</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-400">
              We build intelligent AI systems that transform businesses through custom Microsoft
              Copilots, multi-agent teams, and Bitcoin-powered value exchange networks.
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-gray-800 pt-4 text-sm font-medium text-lime-500">
            <BookOpen className="h-4 w-4" />
            <span>Our Story</span>
          </div>
        </div>
      </div>

      {/* Narrative */}
      <section className="container max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6 text-lg text-gray-300">
          <p>
            KnowAll AI was incorporated in El Salvador in 2025 by our CEO, Ben Weeks — an
            open-source developer with deep roots in the Nostr and Bitcoin communities — on a simple
            belief: intelligence is processing power.
            {/* TODO: confirm founding story details (what prompted starting the company) */}
          </p>
          <p>
            We are an AI consultancy specializing in agent development. From day one our focus has
            been practical, working systems rather than slideware — AI that plugs into the tools
            businesses already use and quietly gets things done.
          </p>
          <p>
            We don&apos;t have dedicated offices. Instead, we&apos;re a distributed team working out
            of Cambridge (UK), El Salvador, Poland, and Ukraine — which means we can accommodate
            clients across time zones.
          </p>
        </div>

        <div className="mt-12 space-y-10">
          <div>
            <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-3">
              <Bot className="h-6 w-6 text-lime-500 flex-shrink-0" />
              Copilots and multi-agent teams
            </h2>
            <p className="text-gray-300">
              We build custom Microsoft Copilots that integrate with Microsoft 365 and Teams, backed
              by the full Power Platform. And because one agent is rarely enough, we use Microsoft
              AutoGen to orchestrate multi-agent teams — specialized agents with distinct roles,
              collaborating with each other and with humans in the loop to solve complex problems.
            </p>
          </div>

          <div>
            <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-3">
              <Zap className="h-6 w-6 text-lime-500 flex-shrink-0" />
              Value for value, powered by Bitcoin
            </h2>
            <p className="text-gray-300">
              We believe contributions — whether human or AI — should be rewarded in proportion to
              the value they deliver. That conviction became Zapp.ie, our open-source platform that
              connects Microsoft Teams with Bitcoin Lightning microtransactions and AI agents, so
              teammates, customers, and copilots can exchange real value with each other.
            </p>
          </div>

          <div>
            <h2 className="flex items-center gap-3 text-xl font-semibold text-white mb-3">
              <Github className="h-6 w-6 text-lime-500 flex-shrink-0" />
              Open source, in the open
            </h2>
            <p className="text-gray-300">
              We build in the open wherever we can. Alongside Zapp.ie we maintain T-Minus-15, our
              open-source delivery process, and even Sally — the AI assistant you can talk to on our
              homepage — because the best way to sell working AI is to run on it ourselves.
            </p>
          </div>
        </div>

        {/* Nostr presence */}
        <div className="mt-14 rounded-xl border border-gray-800 bg-gray-900 p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-white mb-3">Find us on Nostr</h2>
          <p className="text-gray-300 mb-4">
            True to our open-protocol roots, KnowAll AI publishes on Nostr — the decentralized,
            censorship-resistant social protocol built on the same values as Bitcoin.
          </p>
          <p className="font-mono text-sm text-lime-500 break-all mb-6">{COMPANY_NPUB}</p>
          <Button asChild className="bg-lime-600 hover:bg-lime-700 text-white">
            <a href={`https://njump.me/${COMPANY_NPUB}`} target="_blank" rel="noopener noreferrer">
              View our Nostr profile
            </a>
          </Button>
        </div>

        {/* CTA back to services */}
        <div className="mt-14 text-center">
          <p className="text-lg text-gray-300 mb-6">
            Want to be part of the next chapter? See what we can build together.
          </p>
          <Button asChild className="bg-lime-600 hover:bg-lime-700 text-white">
            <Link href="/#services">Explore our services</Link>
          </Button>
        </div>
      </section>

      <Footer darkMode={true} />
    </main>
  );
}
