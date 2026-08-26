/**
 * Tests for the persistent dedup store (ProcessedStore). Verifies that processed
 * order/receipt IDs survive a "restart" (a fresh store reading the same file) and
 * that stale entries outside the lookback window are pruned.
 *
 *   node --test
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProcessedStore } from '../lib/processedStore.js';

function tmpFile() {
  const dir = mkdtempSync(join(tmpdir(), 'processed-store-'));
  return { path: join(dir, '.processed.json'), dir };
}

test('creates a missing parent directory on first save (fresh data/ dir or empty volume)', () => {
  const { dir } = tmpFile();
  try {
    // Point the store at a path whose parent directory does not exist yet —
    // exactly the state of a fresh checkout or a just-created Docker volume.
    const nested = join(dir, 'data', '.processed.json');
    const store = new ProcessedStore(nested, 0);
    store.addOrder('order-1'); // must not warn/fail — save() mkdirs the parent
    const reloaded = new ProcessedStore(nested, 0);
    assert.equal(reloaded.hasOrder('order-1'), true, 'store should persist into the created dir');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('processed IDs survive a restart (persisted to disk)', () => {
  const { path, dir } = tmpFile();
  try {
    const store = new ProcessedStore(path, 0);
    assert.equal(store.hasOrder('order-1'), false);
    store.addOrder('order-1');
    store.addReceipt('receipt-1');

    // Simulate a restart: a brand-new store reading the same file.
    const reloaded = new ProcessedStore(path, 0);
    assert.equal(reloaded.hasOrder('order-1'), true, 'order should persist across restart');
    assert.equal(reloaded.hasReceipt('receipt-1'), true, 'receipt should persist across restart');
    assert.equal(reloaded.hasOrder('order-unknown'), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an already-processed order is not re-processed after restart', () => {
  const { path, dir } = tmpFile();
  try {
    new ProcessedStore(path, 0).addOrder('dup-order');
    const reloaded = new ProcessedStore(path, 0);
    // Mirrors handleOrder's guard: skip when already present.
    assert.equal(reloaded.hasOrder('dup-order'), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('entries older than the lookback window are pruned on load', () => {
  const { path, dir } = tmpFile();
  try {
    const nowSec = Math.floor(Date.now() / 1000);
    const maxAge = 2 * 24 * 60 * 60; // 2 days
    writeFileSync(
      path,
      JSON.stringify({
        orders: {
          'old-order': nowSec - maxAge - 60, // older than window -> pruned
          'fresh-order': nowSec - 60, // within window -> kept
        },
        receipts: {},
      })
    );

    const store = new ProcessedStore(path, maxAge);
    assert.equal(store.hasOrder('old-order'), false, 'stale entry should be pruned');
    assert.equal(store.hasOrder('fresh-order'), true, 'recent entry should be kept');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a persistence failure propagates from addOrder (callers must not assume durability)', () => {
  const { path, dir } = tmpFile();
  try {
    const store = new ProcessedStore(path, 0);
    store.addOrder('order-1'); // create the real file first
    // Point the store's file INSIDE an existing regular file so mkdir/rename fail.
    store.filePath = join(path, 'impossible', '.processed.json');
    assert.throws(() => store.addOrder('order-2'), /ENOTDIR|EEXIST|ENOENT/);
    // The in-memory entry is still there, so this process keeps deduping.
    assert.equal(store.hasOrder('order-2'), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('drops entries with a non-numeric timestamp so prune() can bound the file', () => {
  // A corrupted timestamp coerces to NaN, and every NaN comparison is false —
  // so `NaN < cutoff` in prune() never matches. Left in place, such an entry
  // could never be dropped and the file would grow without bound across
  // restarts.
  const { path, dir } = tmpFile();
  try {
    writeFileSync(
      path,
      JSON.stringify({
        orders: {
          good: Math.floor(Date.now() / 1000),
          corrupt: 'oops',
          nullish: null,
          nested: { not: 'a timestamp' },
        },
        receipts: { alsoCorrupt: 'nope' },
      })
    );

    // maxAgeSeconds set, so load() prunes on construction.
    const store = new ProcessedStore(path, 3600);

    assert.equal(store.orders.size, 1, 'only the valid order timestamp survives');
    assert.ok(store.orders.has('good'));
    assert.equal(store.receipts.size, 0, 'the corrupt receipt is dropped');

    // And the surviving state round-trips without reintroducing them.
    store.save();
    const reloaded = new ProcessedStore(path, 3600);
    assert.equal(reloaded.orders.size, 1);
    assert.equal(reloaded.receipts.size, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
