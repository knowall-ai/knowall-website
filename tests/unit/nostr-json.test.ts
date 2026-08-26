import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { KNOWALL_PUBKEY } from '@/lib/nostr';

// NIP-05 identity file served at /.well-known/nostr.json so the company npub
// verifies as _@knowall.ai (and Ben's as ben.weeks@knowall.ai).
// https://github.com/nostr-protocol/nips/blob/master/05.md

const BEN_PUBKEY = '971615b70ad9ec896f8d5ba0f2d01652f1dfe5f9ced81ac9469ca7facefad68b';

const raw = readFileSync(join(process.cwd(), 'public', '.well-known', 'nostr.json'), 'utf8');

describe('public/.well-known/nostr.json (NIP-05)', () => {
  it('is valid JSON', () => {
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  const json = JSON.parse(raw);

  it('maps _ (root identifier) to the company pubkey from lib/nostr', () => {
    expect(json.names._).toBe(KNOWALL_PUBKEY);
  });

  it('maps ben.weeks to his personal pubkey', () => {
    expect(json.names['ben.weeks']).toBe(BEN_PUBKEY);
  });

  it('uses 64-char lowercase hex pubkeys (not npubs)', () => {
    for (const pubkey of Object.values(json.names)) {
      expect(pubkey).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('lists relay hints for every named pubkey', () => {
    for (const pubkey of Object.values(json.names) as string[]) {
      const relays = json.relays[pubkey];
      expect(Array.isArray(relays)).toBe(true);
      expect(relays.length).toBeGreaterThan(0);
      for (const relay of relays) {
        expect(relay).toMatch(/^wss:\/\//);
      }
    }
  });
});
