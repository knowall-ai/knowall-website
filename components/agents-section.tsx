import Image from 'next/image';
import { Card } from '@/components/ui/card';

interface Agent {
  name: string;
  role: string;
  phase: string;
  image: string;
}

// KnowAll's AI agents, mirroring the T-Minus-15 delivery lifecycle (Idea -> Production).
const agents: Agent[] = [
  { name: 'Sallie', role: 'the Salesperson', phase: 'Idea', image: '/images/agents/sallie.jpg' },
  { name: 'Poppie', role: 'the Planner', phase: 'Prep', image: '/images/agents/poppie.jpg' },
  { name: 'Pennie', role: 'the Prepper', phase: 'Prep', image: '/images/agents/pennie.jpg' },
  { name: 'Dannie', role: 'the Designer', phase: 'Design', image: '/images/agents/dannie.jpg' },
  { name: 'Eddie', role: 'the Engineer', phase: 'Engineer', image: '/images/agents/eddie.jpg' },
  { name: 'Terrie', role: 'the Tester', phase: 'Test', image: '/images/agents/terrie.jpg' },
  { name: 'Ollie', role: 'the Operator', phase: 'Operate', image: '/images/agents/ollie.jpg' },
];

export default function AgentsSection() {
  return (
    <section id="agents" className="py-20 px-4 bg-gray-900">
      <div className="container max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">
          Meet the Agents
        </h2>
        <p className="text-lg text-center text-gray-300 max-w-3xl mx-auto mb-12">
          We practise what we preach. Our AI agents work alongside the team across the{' '}
          <a href="#tminus15" className="text-lime-500 hover:text-lime-400 transition-colors">
            T-Minus-15
          </a>{' '}
          lifecycle — taking work from idea to production.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
          {agents.map((agent) => (
            <Card
              key={agent.name}
              className="p-6 shadow-md border-0 bg-gray-800 text-white flex flex-col items-center text-center"
            >
              <Image
                src={agent.image}
                alt=""
                width={128}
                height={128}
                className="h-32 w-32 rounded-full object-cover mb-4 ring-2 ring-lime-500/50"
              />
              <h3 className="text-xl font-semibold">{agent.name}</h3>
              <p className="text-gray-400 mt-1">{agent.role}</p>
              <span className="mt-3 inline-block rounded-full bg-lime-500/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-lime-400">
                {agent.phase}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
