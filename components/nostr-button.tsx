'use client';

import { Button } from '@/components/ui/button';
import NostrLogo from './nostr-logo';
import { useContactPanel } from '@/components/contact-panel';

interface NostrButtonProps {
  darkMode?: boolean;
}

export default function NostrButton({ darkMode = false }: NostrButtonProps) {
  const { openContactPanel } = useContactPanel();

  return (
    <Button
      onClick={openContactPanel}
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
