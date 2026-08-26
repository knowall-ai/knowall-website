#!/usr/bin/env node
// knowall-listings — manage KnowAll AI's NIP-99 classified listings (kind 30402)
// signed remotely via Amber (NIP-46). See tools/nostr-listings/README.md.
import { parseArgs } from 'node:util';
import { dirname, resolve, isAbsolute } from 'node:path';
import { resolveKeyPath, PUBLISH_RELAYS, COMPANY_NPUB } from './lib/config.mjs';
import {
  definitionToEvent,
  eventToListing,
  formatDate,
  formatPrice,
  isRemoteImage,
  latestByDtag,
  replacementCreatedAt,
  withStatus,
} from './lib/listing.mjs';
import { loadDefinition } from './lib/definition.mjs';

const USAGE = `knowall-listings — manage KnowAll AI's NIP-99 listings (kind 30402)

Usage:
  node tools/nostr-listings/cli.mjs <command> [args] [flags]
  npm run listings -- <command> [args] [flags]

Commands:
  list                    List the company's listings from the relays
  show <d-tag>            Show full detail for one listing
  publish <file.yaml>     Create/update a listing from a YAML definition
  sold <d-tag>            Republish an existing listing with status "sold"
  unlist <d-tag>          Republish an existing listing with status "inactive"

Flags:
  --yes                   Actually sign and publish (publish/sold/unlist)
  --dry-run               Preview only, never sign (default unless --yes)
  --key <path>            NIP-46 client key file
                          (default ~/.config/knowall/nostr-client-key.hex,
                          or KNOWALL_NOSTR_KEY_FILE)
  --help                  Show this help

Signing is human-in-the-loop: every sign request pings Amber on the phone
holding the KnowAll key and can take minutes to be approved.
Examples live in tools/nostr-listings/examples/.`;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function printTable(rows, headers) {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log(line(headers));
  console.log(line(widths.map((w) => '-'.repeat(w))));
  for (const row of rows) console.log(line(row));
}

function printListingDetail(listing, { naddr } = {}) {
  console.log(`d:            ${listing.d}`);
  console.log(`title:        ${listing.title}`);
  if (listing.summary) console.log(`summary:      ${listing.summary}`);
  console.log(`price:        ${formatPrice(listing.price)}`);
  console.log(`status:       ${listing.status}`);
  if (listing.tags.length) console.log(`tags:         ${listing.tags.join(', ')}`);
  if (listing.location) console.log(`location:     ${listing.location}`);
  if (listing.publishedAt) console.log(`published_at: ${formatDate(listing.publishedAt)}`);
  if (listing.createdAt) console.log(`updated:      ${formatDate(listing.createdAt)}`);
  for (const image of listing.images) console.log(`image:        ${image}`);
  if (listing.id) console.log(`event id:     ${listing.id}`);
  if (naddr) console.log(`naddr:        ${naddr}`);
  console.log('\n--- content ---');
  console.log(listing.content);
}

async function fetchLatestListings() {
  const { fetchListingEvents } = await import('./lib/nostr.mjs');
  console.log(`Querying ${PUBLISH_RELAYS.length} relays for listings by ${COMPANY_NPUB}...\n`);
  return latestByDtag(await fetchListingEvents());
}

async function cmdList() {
  const listings = [...(await fetchLatestListings()).values()]
    .map(eventToListing)
    .sort((a, b) => b.createdAt - a.createdAt);
  if (listings.length === 0) {
    console.log('No listings found.');
    return;
  }
  printTable(
    listings.map((l) => [l.d, l.title, formatPrice(l.price), l.status, formatDate(l.createdAt)]),
    ['d-tag', 'title', 'price', 'status', 'updated']
  );
}

async function cmdShow(dTag) {
  if (!dTag) fail('usage: show <d-tag>');
  const event = (await fetchLatestListings()).get(dTag);
  if (!event) fail(`no listing found with d-tag "${dTag}" (try: list)`);
  const { listingNaddr } = await import('./lib/nostr.mjs');
  printListingDetail(eventToListing(event), { naddr: listingNaddr(dTag) });
}

async function signAndPublish(unsignedEvent, keyPath, what) {
  const { connectSigner, signEvent, publishEvent, listingNaddr } = await import('./lib/nostr.mjs');
  const signer = await connectSigner(keyPath);
  const signed = await signEvent(signer, unsignedEvent, what);
  console.log('Publishing to relays...');
  const results = await publishEvent(signed);
  for (const r of results) {
    console.log(`  ${r.relay}: ${r.ok ? 'ok' : `FAILED (${r.reason})`}`);
  }
  if (!results.some((r) => r.ok)) fail('no relay accepted the event — listing NOT published');
  const dTag = signed.tags.find((t) => t[0] === 'd')?.[1];
  console.log(`\nPublished. event id: ${signed.id}`);
  if (dTag) console.log(`naddr: ${listingNaddr(dTag)}`);
  return signed;
}

async function cmdPublish(file, flags) {
  if (!file) fail('usage: publish <file.yaml> [--yes]');
  const def = loadDefinition(file);
  const yamlDir = dirname(resolve(file));
  const images = (def.images ?? []).map((image) => ({
    source: image,
    remote: isRemoteImage(image),
    path: isRemoteImage(image) ? undefined : isAbsolute(image) ? image : resolve(yamlDir, image),
  }));

  // Preview with placeholder URLs for local images (uploads happen after --yes).
  const previewEvent = definitionToEvent(def, {
    imageUrls: images.map((i) => (i.remote ? i.source : `(will upload: ${i.path})`)),
  });
  console.log(`Preview of listing "${def.d}":\n`);
  printListingDetail(eventToListing(previewEvent));
  const localCount = images.filter((i) => !i.remote).length;
  if (localCount > 0) {
    console.log(
      `\n${localCount} local image(s) will be uploaded to Blossom first — each upload needs its own Amber approval.`
    );
  }

  if (flags['dry-run'] || !flags.yes) {
    console.log('\nDry run — nothing signed or published. Re-run with --yes to publish.');
    return;
  }

  const keyPath = resolveKeyPath(flags.key);
  // If a revision of this d-tag already exists, the replacement's created_at must
  // be strictly greater than it (NIP-01 ties keep the lower event id) — check
  // before touching the signer so relay problems surface without pinging Amber.
  const existing = (await fetchLatestListings()).get(def.d);
  const { connectSigner } = await import('./lib/nostr.mjs');
  const { uploadImage } = await import('./lib/blossom.mjs');
  // Connect (and safety-check the key) once, before any uploads.
  const signer = await connectSigner(keyPath);
  const imageUrls = [];
  for (const image of images) {
    imageUrls.push(image.remote ? image.source : await uploadImage(signer, image.path));
  }
  const event = definitionToEvent(def, {
    imageUrls,
    createdAt: replacementCreatedAt(existing?.created_at),
  });
  const { signEvent, publishEvent, listingNaddr } = await import('./lib/nostr.mjs');
  const signed = await signEvent(signer, event, `listing "${def.d}"`);
  console.log('Publishing to relays...');
  const results = await publishEvent(signed);
  for (const r of results) {
    console.log(`  ${r.relay}: ${r.ok ? 'ok' : `FAILED (${r.reason})`}`);
  }
  if (!results.some((r) => r.ok)) fail('no relay accepted the event — listing NOT published');
  console.log(`\nPublished. event id: ${signed.id}`);
  console.log(`naddr: ${listingNaddr(def.d)}`);
}

async function cmdSetStatus(dTag, status, flags) {
  if (!dTag) fail(`usage: ${status === 'sold' ? 'sold' : 'unlist'} <d-tag> [--yes]`);
  const event = (await fetchLatestListings()).get(dTag);
  if (!event) fail(`no listing found with d-tag "${dTag}" (try: list)`);
  const current = eventToListing(event);
  if (current.status === status) {
    console.log(`Listing "${dTag}" already has status "${status}" — nothing to do.`);
    return;
  }
  const updated = withStatus(event, status, {
    createdAt: replacementCreatedAt(event.created_at),
  });
  console.log(`Will republish "${dTag}" (${current.title})`);
  console.log(`  status: ${current.status} -> ${status}\n`);
  if (flags['dry-run'] || !flags.yes) {
    console.log('Dry run — nothing signed or published. Re-run with --yes to publish.');
    return;
  }
  await signAndPublish(updated, resolveKeyPath(flags.key), `status change for "${dTag}"`);
}

async function main() {
  const { values: flags, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      yes: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      key: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  const [command, arg] = positionals;
  if (flags.help || !command) {
    console.log(USAGE);
    return;
  }
  if (flags.yes && flags['dry-run']) fail('--yes and --dry-run are mutually exclusive');
  switch (command) {
    case 'list':
      return cmdList();
    case 'show':
      return cmdShow(arg);
    case 'publish':
      return cmdPublish(arg, flags);
    case 'sold':
      return cmdSetStatus(arg, 'sold', flags);
    case 'unlist':
      return cmdSetStatus(arg, 'inactive', flags);
    default:
      fail(`unknown command "${command}"\n\n${USAGE}`);
  }
}

main().then(
  () => process.exit(0), // open relay sockets would otherwise keep the process alive
  (err) => {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
);
