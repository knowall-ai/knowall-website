'use client';

import { Button } from '@/components/ui/button';
import NostrLogo from './nostr-logo';

interface NostrButtonProps {
  darkMode?: boolean;
}

export default function NostrButton({ darkMode = false }: NostrButtonProps) {
  const openNostr = () => {
    // KnowAll AI's Nostr profile on njump.me
    const nostrUrl =
      'https://njump.me/npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar';

    // Open in new tab
    window.open(nostrUrl, '_blank');
  };

  return (
    <Button
      onClick={openNostr}
      className={
        darkMode
          ? 'bg-violet-600 hover:bg-violet-700 text-white'
          : 'bg-violet-500 hover:bg-violet-600'
      }
    >
      <NostrLogo className="mr-2 h-4 w-4" />
      Nostr
    </Button>
  );
}
