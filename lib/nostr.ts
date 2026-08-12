/**
 * KnowAll AI's Nostr identity, shared between server components (links, npub
 * display) and the client-side story feed (relay subscription filter).
 */
export const KNOWALL_PUBKEY = 'b733ecad265d8df63e15e28d24972141a5ebc21bfdf1532adad2e6701e853892';
export const KNOWALL_NPUB = 'npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar';

/**
 * Relays queried for shop listings (same set as the story feed). Shared by the
 * shop grid, the product detail page, and naddr relay hints.
 */
export const SHOP_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];
