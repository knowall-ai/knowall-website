import type React from 'react';

// Small brand glyphs for the agent embodiment tags. Inline SVGs because
// lucide-react dropped brand icons (see components/github-icon.tsx).
export type Embodiment = 'claude' | 'ms-account' | 'teams-bot';

export const EMBODIMENT_LABELS: Record<Embodiment, string> = {
  claude: 'Claude Code Agent',
  'ms-account': 'Microsoft Account',
  'teams-bot': 'Microsoft Teams Bot',
};

function ClaudeIcon({ className }: { className?: string }) {
  // Anthropic's Claude starburst, simplified to eight rays
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      {[0, 45, 90, 135].map((deg) => (
        <line
          key={deg}
          x1="12"
          y1="2.5"
          x2="12"
          y2="21.5"
          stroke="#D97757"
          strokeWidth="3"
          strokeLinecap="round"
          transform={`rotate(${deg} 12 12)`}
        />
      ))}
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="9.5" height="9.5" fill="#F25022" />
      <rect x="12.5" y="2" width="9.5" height="9.5" fill="#7FBA00" />
      <rect x="2" y="12.5" width="9.5" height="9.5" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" fill="#FFB900" />
    </svg>
  );
}

function TeamsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="#5B5FC7" />
      <path d="M7 8h10v2.6h-3.6V17h-2.8v-6.4H7V8z" fill="#fff" />
    </svg>
  );
}

export function EmbodimentIcon({
  embodiment,
  className,
}: {
  embodiment: Embodiment;
  className?: string;
}): React.JSX.Element {
  switch (embodiment) {
    case 'claude':
      return <ClaudeIcon className={className} />;
    case 'ms-account':
      return <MicrosoftIcon className={className} />;
    case 'teams-bot':
      return <TeamsIcon className={className} />;
    default: {
      // Compile-time guard: adding an Embodiment without a case here is a type error.
      const unhandled: never = embodiment;
      throw new Error(`Unhandled embodiment: ${String(unhandled)}`);
    }
  }
}
