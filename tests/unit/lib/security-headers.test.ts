import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import {
  baselineHeaders,
  deckCsp,
  deckScriptHashes,
  pageCsp,
  resourceCsp,
} from '@/lib/security-headers.mjs';
import { proxy } from '@/proxy';

const directive = (csp: string, name: string) =>
  csp
    .split('; ')
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1);

describe('baselineHeaders', () => {
  const byKey = Object.fromEntries(baselineHeaders.map((h) => [h.key, h.value]));

  it('sets the baseline security headers', () => {
    expect(byKey['Strict-Transport-Security']).toBe('max-age=63072000; includeSubDomains');
    expect(byKey['X-Content-Type-Options']).toBe('nosniff');
    expect(byKey['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(byKey['X-Frame-Options']).toBe('DENY');
  });

  it('allows only the microphone (for Sallie), never camera or location', () => {
    const policy = byKey['Permissions-Policy'];
    expect(policy).toContain('microphone=(self)');
    expect(policy).toContain('camera=()');
    expect(policy).toContain('geolocation=()');
  });
});

describe('pageCsp', () => {
  it('allows scripts only by nonce, with no unsafe-inline or unsafe-eval', () => {
    const script = directive(pageCsp('abc123'), 'script-src');
    expect(script).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
  });

  it('adds unsafe-eval in development only', () => {
    expect(directive(pageCsp('n', { dev: true }), 'script-src')).toContain("'unsafe-eval'");
  });

  it('blocks framing and plugins', () => {
    const csp = pageCsp('n');
    expect(directive(csp, 'frame-ancestors')).toBe("'none'");
    expect(directive(csp, 'object-src')).toBe("'none'");
  });
});

describe('deck CSP', () => {
  let dir: string | undefined;
  afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

  it('hashes inline scripts and ignores external ones', () => {
    dir = mkdtempSync(join(tmpdir(), 'decks-'));
    const body = "document.title = 'x';";
    writeFileSync(
      join(dir, 'a.html'),
      `<script src="vendor/reveal.js"></script><script>${body}</script>`
    );
    const expected = `'sha256-${createHash('sha256').update(body).digest('base64')}'`;
    expect(deckScriptHashes(dir)).toEqual([expected]);
    expect(directive(deckCsp([expected]), 'script-src')).toBe(`'self' ${expected}`);
  });

  it('covers every inline script in the real decks', () => {
    const decks = join(process.cwd(), 'public/presentations');
    const hashes = deckScriptHashes(decks);
    const inline = readdirSync(decks)
      .filter((f) => f.endsWith('.html'))
      .flatMap((f) => [
        ...readFileSync(join(decks, f), 'utf8').matchAll(
          /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi
        ),
      ]);
    expect(hashes.length).toBe(new Set(inline.map((m) => m[1])).size);
    expect(directive(deckCsp(hashes), 'script-src')).not.toContain('unsafe-inline');
  });
});

describe('proxy', () => {
  it('sets a fresh nonce CSP on pages and forwards it to the renderer', () => {
    const a = proxy(new NextRequest('https://www.knowall.ai/'));
    const b = proxy(new NextRequest('https://www.knowall.ai/'));
    const cspA = a.headers.get('Content-Security-Policy')!;
    expect(cspA).toMatch(/'nonce-[A-Za-z0-9+/=]+'/);
    expect(cspA).not.toBe(b.headers.get('Content-Security-Policy'));
    expect(a.headers.get('x-middleware-request-content-security-policy')).toBe(cspA);
  });

  it('gives API routes and files a locked-down policy', () => {
    for (const url of ['https://www.knowall.ai/api/chat', 'https://www.knowall.ai/logo.svg']) {
      expect(proxy(new NextRequest(url)).headers.get('Content-Security-Policy')).toBe(resourceCsp);
    }
  });
});
