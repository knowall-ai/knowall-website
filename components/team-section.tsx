'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, UserRound } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface TeamMember {
  name: string;
  title?: string;
  npub: string;
  pubkey: string; // hex form of npub, used to query relays
}

const teamMembers: TeamMember[] = [
  {
    name: 'Ben Weeks',
    title: 'Chief Builder',
    npub: 'npub1jutptdc2m8kgjmudtws095qk2tcale0eemvp4j2xnjnl4nh6669slrf04x',
    pubkey: '971615b70ad9ec896f8d5ba0f2d01652f1dfe5f9ced81ac9469ca7facefad68b',
  },
  {
    name: 'Valeriia Khudiakova',
    title: 'Chief Planner',
    npub: 'npub1dg75du7l0usuhlg7ttvkm2x9lfcvq29fh43ckc420m6fk7ps2gls09kvl5',
    pubkey: '6a3d46f3df7f21cbfd1e5ad96da8c5fa70c028a9bd638b62aa7ef49b7830523f',
  },
  {
    name: 'Akash Jadhav',
    title: 'Senior Engineer',
    npub: 'npub1eflxeu2asp4th6yzmmdeescu3jkh5e4refwktj0cgpvl6f3efhmszc4lj0',
    pubkey: 'ca7e6cf15d806abbe882dedb9cc31c8cad7a66a3ca5d65c9f84059fd26394df7',
  },
  {
    name: 'Edit Weeks',
    title: 'Chief Tester',
    npub: 'npub1wdzc9uy9wggfjf8sz8tvj39utkgf0vj8874x05ptqkxf28sqqlnsxw2z0e',
    pubkey: '734582f08572109924f011d6c944bc5d9097b2473faa67d02b058c951e0007e7',
  },
  {
    name: 'Wilmer Salazar',
    title: 'Bitcoin & AI Engineer',
    npub: 'npub1cplxtxuqnrm26n3g0r0lt8w2jfkurwzu848hztf05ad0ds962syqgkq7nr',
    pubkey: 'c07e659b8098f6ad4e2878dff59dca926dc1b85c3d4f712d2fa75af6c0ba5408',
  },
];

// purplepag.es is a dedicated profile aggregator; the others are general-purpose relays
const PROFILE_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://purplepag.es'];

export default function TeamSection() {
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const [broken, setBroken] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Fetch each member's kind-0 (profile metadata) event and keep the newest picture per pubkey
    const newest: Record<string, number> = {};
    const authors = teamMembers.map((m) => m.pubkey);
    const sockets: WebSocket[] = [];

    for (const relay of PROFILE_RELAYS) {
      let ws: WebSocket;
      try {
        ws = new WebSocket(relay);
      } catch {
        continue;
      }
      sockets.push(ws);
      // one filter per author: some relays (e.g. purplepag.es) drop authors from a combined filter
      ws.onopen = () =>
        ws.send(
          JSON.stringify([
            'REQ',
            'team-profiles',
            ...authors.map((a) => ({ kinds: [0], authors: [a] })),
          ])
        );
      ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          if (data[0] === 'EVENT') {
            const event = data[2];
            const { picture } = JSON.parse(event.content);
            if (
              (newest[event.pubkey] ?? 0) < event.created_at &&
              typeof picture === 'string' &&
              picture.startsWith('https://')
            ) {
              newest[event.pubkey] = event.created_at;
              setPictures((prev) => ({ ...prev, [event.pubkey]: picture }));
            }
          } else if (data[0] === 'EOSE') {
            ws.close();
          }
        } catch {
          // ignore malformed relay messages
        }
      };
    }

    const closeAll = () =>
      sockets.forEach((ws) => {
        try {
          ws.close();
        } catch {
          // already closed
        }
      });
    const timeout = setTimeout(closeAll, 10000);
    return () => {
      clearTimeout(timeout);
      closeAll();
    };
  }, []);

  return (
    <section id="team" className="py-20 px-4 bg-gray-800">
      <div className="container max-w-6xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-center text-white">
          Meet the Team
        </h2>
        <p className="text-lg text-center text-gray-300 max-w-3xl mx-auto mb-12">
          The people behind our AI systems. Connect with us on Nostr.
        </p>

        <div className="flex flex-wrap justify-center gap-8">
          {teamMembers.map((member) => (
            <Card
              key={member.npub}
              className="p-6 shadow-md border-0 bg-gray-900 text-white flex flex-col items-center text-center w-full max-w-xs sm:w-64"
            >
              {pictures[member.pubkey] && !broken[member.pubkey] ? (
                // eslint-disable-next-line @next/next/no-img-element -- avatar URLs come from Nostr profiles, hosts unknown at build time
                <img
                  src={pictures[member.pubkey]}
                  alt={member.name}
                  className="h-32 w-32 rounded-full object-cover mb-4 ring-2 ring-lime-500/50"
                  onError={() => setBroken((prev) => ({ ...prev, [member.pubkey]: true }))}
                />
              ) : (
                <div
                  className="h-32 w-32 rounded-full mb-4 ring-2 ring-lime-500/50 bg-gray-700 flex items-center justify-center"
                  aria-hidden="true"
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
