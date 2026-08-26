# knowall-listings — NIP-99 listing manager

CLI for managing KnowAll AI's [NIP-99](https://github.com/nostr-protocol/nips/blob/master/99.md)
classified listings (kind-30402 events) published under the company key
`npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar`.

Signing is remote and **human-in-the-loop**: events are signed via
[Amber](https://github.com/greenart7c3/Amber) (NIP-46) on the phone holding the
company key. Every sign request pops an approval prompt on that phone and can
take minutes — the CLI waits up to 8 minutes per request and says what it is
waiting for.

## Setup

1. **Dependencies** — installed with the repo: `npm ci` at the repo root
   (uses `nostr-tools`, `ws`, `yaml`).
2. **Client key file** — the NIP-46 _client_ key already paired with Amber, as
   64 hex chars in `~/.config/knowall/nostr-client-key.hex` (mode 600).
   Override with `--key <path>` or the `KNOWALL_NOSTR_KEY_FILE` env var.
   This is not the company key — it only lets this machine _request_
   signatures, which Amber approves manually.
3. **Amber pairing context** — the pairing (client key, Amber's signer pubkey
   and pairing relays) is baked into `lib/config.mjs`. If the pairing is ever
   revoked in Amber, a new nostrconnect pairing must be made and the client
   key file and `BUNKER` config updated. The CLI safety-checks that the signer
   returns the company pubkey before signing anything, and refuses otherwise.

## Commands

Run via `node tools/nostr-listings/cli.mjs <command>` or
`npm run listings -- <command>`.

| Command               | What it does                                                                    |
| --------------------- | ------------------------------------------------------------------------------- |
| `list`                | Query the relays for the company's listings; table of d-tag/title/price/status. |
| `show <d-tag>`        | Full detail for one listing, including content and naddr.                       |
| `publish <file.yaml>` | Create or update a listing from a YAML definition (see schema below).           |
| `sold <d-tag>`        | Republish an existing listing with `status: sold`.                              |
| `unlist <d-tag>`      | Republish an existing listing with `status: inactive`.                          |

`publish`, `sold` and `unlist` always show a preview first and do **nothing**
without `--yes`. `--dry-run` forces preview-only explicitly. Reads (`list`,
`show`) never touch the signer.

```bash
npm run listings -- list
npm run listings -- show tminus15-book
npm run listings -- publish tools/nostr-listings/examples/tminus15-book.yaml            # dry-run preview
npm run listings -- publish tools/nostr-listings/examples/tminus15-book.yaml --yes      # sign + publish
npm run listings -- sold knowall-sticker-pack --yes
```

Relays (publish and query): `relay.damus.io`, `nos.lol`, `relay.primal.net`,
`purplepag.es`. Note: purplepag.es silently drops multi-author filters, so
queries always use a single-author filter.

## YAML schema

```yaml
d: my-widget # required — stable listing identifier (the d-tag), no spaces
title: My Widget # required
summary: One-line tagline # required
price: # required
  amount: '9.99' # number or string
  currency: GBP # GBP, SATS, USD, ...
  frequency: month # optional — for recurring prices
status: active # optional — active | sold | inactive (omitted = active)
published_at: 1786555390 # optional — unix seconds; set it when updating an existing
#                          listing so the first-publish date is preserved
tags: # optional — NIP-99 "t" hashtags
  - merch
images: # optional — mixed local paths and URLs, in display order
  - https://example.com/already-hosted.png # kept as-is
  - ./photos/widget.png # local file: uploaded to Blossom (blossom.primal.net)
#                          automatically; each upload needs its own Amber approval.
#                          Relative paths resolve against the YAML file's directory.
location: Ships from UK # optional
content: |- # required — the listing body, Markdown
  **My Widget** — description...
```

NIP-99 defines `status` as `active`/`sold`; `inactive` (used by `unlist`) is a
common marketplace extension for withdrawing a listing without deleting it.

## Examples

- `examples/tminus15-book.yaml` — the live T-Minus-15 paperback listing
  (`d: tminus15-book`), including its original `published_at`.
- `examples/knowall-sticker-pack.yaml` — the sticker pack listing
  (`d: knowall-sticker-pack`), with local image paths that upload on publish.

Republishing either is a one-liner:

```bash
npm run listings -- publish tools/nostr-listings/examples/knowall-sticker-pack.yaml --yes
```

## Troubleshooting

- **"Timed out after 8 minutes waiting for Amber..."** — nobody approved the
  request on the phone. Open Amber, approve (or check the pairing still
  exists), re-run.
- **"SAFETY STOP: signer returned pubkey..."** — the client key is paired with
  a signer that is not the KnowAll company key. Nothing was signed; fix the
  key file/pairing.
- **"cannot read client key file..."** — put the paired client key at
  `~/.config/knowall/nostr-client-key.hex`, or point `--key` /
  `KNOWALL_NOSTR_KEY_FILE` at it.

## Layout

- `cli.mjs` — command-line entry point
- `lib/listing.mjs` — pure YAML-definition ↔ kind-30402 mapping (unit-tested
  in `tests/unit/tools/nostr-listings.test.ts`)
- `lib/definition.mjs` — YAML loading + validation
- `lib/nostr.mjs` — Amber signer connection, relay query/publish
- `lib/blossom.mjs` — Blossom image upload (kind-24242 auth)
- `lib/config.mjs` — company key, pairing, relays, timeouts
