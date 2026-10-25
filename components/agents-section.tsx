import Image from 'next/image';
import { Card } from '@/components/ui/card';
import { EmbodimentIcon, EMBODIMENT_LABELS, type Embodiment } from '@/components/embodiment-icons';

interface Agent {
  name: string;
  role: string;
  phase: string;
  image: string;
  embodiments: Embodiment[];
}

// KnowAll's AI agents, mirroring the T-Minus-15 delivery lifecycle (Idea -> Production).
// Embodiments: how each agent runs — every agent is a Claude Code agent except Zaplie
// (a Microsoft Teams bot); Sallie also has her own Microsoft account.
const agents: Agent[] = [
  {
    name: 'Sallie',
    role: 'the Salesperson',
    phase: 'Idea',
    image: '/images/agents/sallie.jpg',
    embodiments: ['claude', 'ms-account'],
  },
  {
    name: 'Poppie',
    role: 'the Planner',
    phase: 'Plan',
    image: '/images/agents/poppie.jpg',
    embodiments: ['claude'],
  },
  {
    name: 'Preppie',
    role: 'the Prepper',
    phase: 'Prep',
    image: '/images/agents/preppie.jpg',
    embodiments: ['claude'],
  },
  {
    name: 'Archie',
    role: 'the Architect',
    phase: 'Design',
    image: '/images/agents/archie.jpg',
    embodiments: ['claude'],
  },
  {
    name: 'Dannie',
    role: 'the Designer',
    phase: 'Design',
    image: '/images/agents/dannie.jpg',
    embodiments: ['claude'],
  },
  {
    name: 'Ernie',
    role: 'the Engineer',
    phase: 'Engineer',
    image: '/images/agents/ernie.jpg',
    embodiments: ['claude'],
  },
  {
    name: 'Teddie',
    role: 'the Tester',
    phase: 'Test',
    image: '/images/agents/teddie.jpg',
    embodiments: ['claude'],
  },
  {
    name: 'Pennie',
    role: 'the Penetration Tester',
    phase: 'Test',
    image: '/images/agents/pennie.jpg',
    embodiments: ['claude'],
  },
  {
    name: 'Ollie',
    role: 'the Operator',
    phase: 'Operate',
    image: '/images/agents/ollie.jpg',
    embodiments: ['claude'],
  },
  {
    name: 'Allie',
    role: 'the Accountant',
    phase: 'Accounts',
    image: '/images/agents/allie.jpg',
    embodiments: ['claude'],
  },
  {
    name: 'Zaplie',
    role: 'the Rewards Agent',
    phase: 'Rewards',
    image: '/images/agents/zaplie.jpg',
    embodiments: ['teams-bot'],
  },
];

const legend: Embodiment[] = ['claude', 'ms-account', 'teams-bot'];

/**
 * The agents, shown inside "Meet the Team" after the people, like the deck's
 * blended-squad slide: a divider reading "…and the agents", then the agents.
 */
export default function AgentsSection() {
  return (
    <div id="agents" className="mt-20 scroll-mt-24">
      <div className="mb-8 flex items-center gap-4" role="presentation">
        <span className="h-px flex-1 bg-gradient-to-r from-transparent to-brand/50" />
        <h3 className="text-sm font-semibold uppercase tracking-[0.25em] text-brand">
          …and the agents
        </h3>
        <span className="h-px flex-1 bg-gradient-to-l from-transparent to-brand/50" />
      </div>
      <div>
        <p className="text-lg text-center text-gray-300 max-w-3xl mx-auto mb-12">
          We practise what we preach. Our AI agents work alongside the team across the{' '}
          <a href="#tminus15" className="text-brand hover:text-brand-hover transition-colors">
            T-Minus-15
          </a>{' '}
          lifecycle — taking work from idea to production.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
          {agents.map((agent) => (
            <Card
              key={agent.name}
              className="p-6 shadow-md border-0 bg-gray-900 text-white flex flex-col items-center text-center"
            >
              <Image
                src={agent.image}
                alt={`${agent.name} ${agent.role} — robot portrait`}
                width={128}
                height={128}
                className="h-32 w-32 rounded-full object-cover mb-4 ring-2 ring-brand/50"
              />
              <h3 className="text-xl font-semibold">{agent.name}</h3>
              <p className="text-gray-400 mt-1">{agent.role}</p>
              <span className="mt-3 inline-block rounded-full bg-brand/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-brand">
                {agent.phase}
              </span>
              <span
                className="mt-3 flex items-center gap-2"
                data-testid={`${agent.name.toLowerCase()}-embodiments`}
              >
                {agent.embodiments.map((e) => (
                  <span key={e} title={EMBODIMENT_LABELS[e]} className="inline-flex">
                    <EmbodimentIcon embodiment={e} className="h-4 w-4" />
                    <span className="sr-only">{EMBODIMENT_LABELS[e]}</span>
                  </span>
                ))}
              </span>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-400">
          {legend.map((e) => (
            <span key={e} className="inline-flex items-center gap-2">
              <span title={EMBODIMENT_LABELS[e]} className="inline-flex">
                <EmbodimentIcon embodiment={e} className="h-4 w-4" />
              </span>
              {EMBODIMENT_LABELS[e]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
