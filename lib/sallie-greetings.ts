/**
 * Sallie's opening lines. One is picked per visit so she doesn't sound like
 * a recording, and the chosen id is logged with the conversation so we can
 * learn which openers actually lead somewhere.
 *
 * Every greeting: British, warm, short enough to speak in ~10s, mentions
 * Sallie by name, gives the visitor a hook, and ends with one question.
 */

export interface Greeting {
  id: string;
  text: string;
}

export const GREETINGS: Greeting[] = [
  {
    id: 'classic',
    text: "Hi, I'm Sallie — welcome to KnowAll AI. I can tell you about our AI agents, Microsoft Copilot work, Bitcoin integration and how we deliver with T-Minus-15. What brings you here today?",
  },
  {
    id: 'agent-herself',
    text: "Hello! Sallie here, KnowAll AI's sales agent — and yes, I'm an AI agent myself, which is rather the point. Curious what one could do for your business? Ask me anything.",
  },
  {
    id: 'problem-first',
    text: "Welcome to KnowAll AI — I'm Sallie. We build AI agents and Microsoft Copilots for businesses, and we pay for value in Bitcoin. What's the problem you're hoping AI might solve?",
  },
  {
    id: 'time-sink',
    text: "Hi there, I'm Sallie. Fair warning: I'm a robot with opinions. Tell me what your team spends far too much time on — shall we see whether an AI agent could take it off your hands?",
  },
  {
    id: 'voice-invite',
    text: "Hello, I'm Sallie from KnowAll AI. You can type, or just tap the mic and talk to me — I'm rather good at listening. What would you like to know about working with us?",
  },
  {
    id: 'three-questions',
    text: "Hi, Sallie here. Most people ask me one of three things: what we build, what it costs, or whether the Bitcoin part is real. Which one's yours?",
  },
];

/** Pick a greeting; pass a random function to make the choice deterministic. */
export function pickGreeting(random: () => number = Math.random): Greeting {
  const index = Math.min(GREETINGS.length - 1, Math.floor(random() * GREETINGS.length));
  return GREETINGS[index];
}
