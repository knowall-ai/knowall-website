import { homedir } from 'node:os';
import { join } from 'node:path';

/** The KnowAll AI company key — the only key this tool will ever sign with. */
export const COMPANY_NPUB = 'npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar';

/**
 * The Amber (NIP-46) remote signer this client is paired with: Amber's signer
 * pubkey plus the relays the original nostrconnect pairing used. The client is
 * already authorised, so BunkerSigner goes straight to requests — no connect().
 */
export const BUNKER = {
  pubkey: '2eee3dbd5293bc441d48eb59b85b13cd4e562bf93843992b2f128f383baa47cf',
  relays: ['wss://relay.primal.net/', 'wss://nostr.oxtr.dev/', 'wss://theforest.nostr1.com/'],
  secret: '',
};

/** Relays listings are published to and read from. */
export const PUBLISH_RELAYS = [
  'wss://relay.damus.io',
  'wss://nos.lol',
  'wss://relay.primal.net',
  'wss://purplepag.es',
];

/** Blossom media server for image uploads. */
export const BLOSSOM_URL = 'https://blossom.primal.net';

/** Every Amber request is approved by a human on a phone — be patient. */
export const AMBER_TIMEOUT_MS = 8 * 60 * 1000;

/** How long to wait for relays when querying listings. */
export const QUERY_TIMEOUT_MS = 10_000;

export const DEFAULT_KEY_PATH = join(homedir(), '.config', 'knowall', 'nostr-client-key.hex');

/**
 * Resolve the NIP-46 client key file path: --key flag, then
 * KNOWALL_NOSTR_KEY_FILE env var, then the default location.
 */
export function resolveKeyPath(flagValue) {
  return flagValue || process.env.KNOWALL_NOSTR_KEY_FILE || DEFAULT_KEY_PATH;
}
