/**
 * A tiny, dependency-free Application Insights sender for first-party analytics.
 *
 * The App Service's codeless agent already instruments requests; this only adds
 * page views (from the /api/collect beacon) and Sallie chat turns (custom events)
 * by posting envelopes straight to the resource's ingestion endpoint. No browser
 * SDK, no cookies, and the connection string never leaves the server.
 *
 * Privacy: the visitor's address is never sent. Only a truncated network
 * (IPv4 /24, IPv6 /48) goes in the `ai.location.ip` tag, which App Insights uses
 * to resolve country, region and city and then discards (IP masking is on).
 */

export interface IngestionConfig {
  iKey: string;
  endpoint: string;
}

const DEFAULT_ENDPOINT = 'https://dc.services.visualstudio.com/';
/** Shown as cloud_RoleName, the same name the codeless agent reports. */
export const ROLE_NAME = 'knowall-website';
export const SDK_VERSION = 'knowall-beacon:1.0.0';

/** Parses an App Insights connection string; null when it has no instrumentation key. */
export function parseConnectionString(value: string | undefined): IngestionConfig | null {
  if (!value) return null;
  const parts = new Map<string, string>();
  for (const pair of value.split(';')) {
    const at = pair.indexOf('=');
    if (at > 0) parts.set(pair.slice(0, at).trim().toLowerCase(), pair.slice(at + 1).trim());
  }
  const iKey = parts.get('instrumentationkey');
  if (!iKey) return null;
  let endpoint = parts.get('ingestionendpoint') || DEFAULT_ENDPOINT;
  if (!endpoint.endsWith('/')) endpoint += '/';
  return { iKey, endpoint };
}

export function ingestionConfig(): IngestionConfig | null {
  return parseConnectionString(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING);
}

/**
 * The network part of an address, for geolocation only: IPv4 keeps the first
 * three octets (a.b.c.0), IPv6 the first three groups (/48). Anything else: null.
 */
export function truncateIp(ip: string | undefined): string | null {
  if (!ip) return null;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const octets = v4.slice(1, 4).map(Number);
    if (octets.some((o) => o > 255)) return null;
    return `${octets.join('.')}.0`;
  }
  if (ip.includes(':') && /^[0-9a-f:.]+$/i.test(ip)) {
    // Expand "::" just enough to take the first three groups
    const [head] = ip.split('::');
    const groups = head ? head.split(':') : [];
    while (groups.length < 3) groups.push('0');
    return `${groups.slice(0, 3).join(':')}::`;
  }
  return null;
}

type Properties = Record<string, string>;

interface EnvelopeBase {
  time: Date;
  /** Anonymous, daily-rotating visitor id (see privacy.ts) */
  visitorId: string;
  /** Truncated network for geolocation; omitted when unknown */
  geoIp?: string | null;
  operationName?: string;
  properties: Properties;
}

export interface Envelope {
  name: string;
  time: string;
  iKey: string;
  tags: Record<string, string>;
  data: { baseType: string; baseData: Record<string, unknown> };
}

function tags(base: EnvelopeBase): Record<string, string> {
  return {
    'ai.cloud.role': ROLE_NAME,
    'ai.internal.sdkVersion': SDK_VERSION,
    'ai.user.id': base.visitorId,
    'ai.session.id': base.visitorId,
    // 0.0.0.0 when unknown, so ingestion doesn't geolocate our own server instead
    'ai.location.ip': base.geoIp || '0.0.0.0',
    ...(base.operationName ? { 'ai.operation.name': base.operationName } : {}),
  };
}

const iKeyName = (iKey: string) => iKey.replace(/-/g, '');

export function pageViewEnvelope(
  cfg: IngestionConfig,
  view: EnvelopeBase & { url: string; title: string }
): Envelope {
  return {
    name: `Microsoft.ApplicationInsights.${iKeyName(cfg.iKey)}.Pageview`,
    time: view.time.toISOString(),
    iKey: cfg.iKey,
    tags: tags(view),
    data: {
      baseType: 'PageviewData',
      baseData: { ver: 2, name: view.title, url: view.url, properties: view.properties },
    },
  };
}

export function eventEnvelope(
  cfg: IngestionConfig,
  event: EnvelopeBase & { eventName: string }
): Envelope {
  return {
    name: `Microsoft.ApplicationInsights.${iKeyName(cfg.iKey)}.Event`,
    time: event.time.toISOString(),
    iKey: cfg.iKey,
    tags: tags(event),
    data: {
      baseType: 'EventData',
      baseData: { ver: 2, name: event.eventName, properties: event.properties },
    },
  };
}

/**
 * Posts envelopes to the ingestion endpoint. Never throws and never waits more
 * than `timeoutMs`: analytics must not slow down or break a page or a chat.
 */
export async function sendEnvelopes(
  cfg: IngestionConfig,
  envelopes: Envelope[],
  { fetchImpl = fetch, timeoutMs = 3000 }: { fetchImpl?: typeof fetch; timeoutMs?: number } = {}
): Promise<boolean> {
  if (envelopes.length === 0) return true;
  try {
    const res = await fetchImpl(`${cfg.endpoint}v2.1/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelopes),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) console.warn(`App Insights ingestion returned ${res.status}`);
    return res.ok;
  } catch (error) {
    console.warn('App Insights ingestion failed:', (error as Error)?.message ?? error);
    return false;
  }
}
