import Image from 'next/image';
import { ExternalLink, UserRound } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface TeamMember {
  name: string;
  title?: string;
  npub: string;
  image?: string;
}

const teamMembers: TeamMember[] = [
  {
    name: 'Ben Weeks',
    title: 'Founder',
    npub: 'npub1jutptdc2m8kgjmudtws095qk2tcale0eemvp4j2xnjnl4nh6669slrf04x',
    image: '/images/team/ben-weeks.png',
  },
  {
    name: 'Valeriia Khudiakova',
    npub: 'npub1dg75du7l0usuhlg7ttvkm2x9lfcvq29fh43ckc420m6fk7ps2gls09kvl5',
  },
  {
    name: 'Akash Jadhav',
    npub: 'npub1eflxeu2asp4th6yzmmdeescu3jkh5e4refwktj0cgpvl6f3efhmszc4lj0',
    image: '/images/team/akash-jadhav.jpg',
  },
  {
    name: 'Edit Weeks',
    npub: 'npub1wdzc9uy9wggfjf8sz8tvj39utkgf0vj8874x05ptqkxf28sqqlnsxw2z0e',
    image: '/images/team/edit-weeks.jpg',
  },
];

export default function TeamSection() {
  return (
    <section id="team" className="py-20 px-4 bg-gray-800">
      <div className="container max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">
          Meet the Team
        </h2>
        <p className="text-lg text-center text-gray-300 max-w-3xl mx-auto mb-12">
          The people behind our AI systems. Connect with us on Nostr.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {teamMembers.map((member) => (
            <Card
              key={member.npub}
              className="p-6 shadow-md border-0 bg-gray-900 text-white flex flex-col items-center text-center"
            >
              {member.image ? (
                <Image
                  src={member.image}
                  alt={member.name}
                  width={128}
                  height={128}
                  className="h-32 w-32 rounded-full object-cover mb-4 ring-2 ring-lime-500/50"
                />
              ) : (
                <div
                  className="h-32 w-32 rounded-full mb-4 ring-2 ring-lime-500/50 bg-gray-700 flex items-center justify-center"
                  aria-label={member.name}
                  role="img"
                >
                  <UserRound className="h-20 w-20 text-gray-400" strokeWidth={1.25} />
                </div>
              )}
              <h3 className="text-xl font-semibold">{member.name}</h3>
              {member.title && <p className="text-gray-400 mt-1">{member.title}</p>}
              <a
                href={`https://njump.me/${member.npub}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-4 text-sm text-lime-500 hover:text-lime-400 transition-colors"
              >
                Nostr profile <ExternalLink className="h-4 w-4" />
              </a>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
