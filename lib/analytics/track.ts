import { clientIp } from '@/lib/rate-limit';
import {
  type IngestionConfig,
  eventEnvelope,
  ingestionConfig,
  pageViewEnvelope,
  sendEnvelopes,
  truncateIp,
} from './app-insights';
import { isBot, optedOut, truncate, visitorId } from './privacy';

/** The custom event name the sales portal's Website page reads. */
export const CHAT_EVENT = 'SallieChatTurn';
/** Longest visitor message and reply kept on an event (App Insights allows 8192). */
export const MAX_MESSAGE = 2000;
export const MAX_REPLY = 4000;

function requestHost(req: Request): string {
  return req.headers.get('host') || 'www.knowall.ai';
}

/** Visitor id and geolocation network for a request; both omitted when opted out. */
function who(req: Request, now: Date): { visitorId: string; geoIp: string | null } {
  if (optedOut(req.headers)) return { visitorId: 'anonymous', geoIp: null };
  const ip = clientIp(req);
  const ua = req.headers.get('user-agent') || '';
  return { visitorId: visitorId(ip, ua, now), geoIp: truncateIp(ip) };
}

export interface PageView {
  path: string;
  title: string;
  referrer: string;
}

/**
 * One page view from the beacon. Returns false (and sends nothing) when the
 * visitor opted out, looks like a bot, or analytics isn't configured.
 */
export async function trackPageView(
  req: Request,
  view: PageView,
  { cfg = ingestionConfig(), now = new Date(), fetchImpl }: TrackOptions = {}
): Promise<boolean> {
  if (!cfg || optedOut(req.headers) || isBot(req.headers.get('user-agent') || '')) return false;
  const host = requestHost(req);
  let referrerHost = '';
  try {
    referrerHost = view.referrer ? new URL(view.referrer).hostname.replace(/^www\./, '') : '';
  } catch {
    /* direct */
  }
  const envelope = pageViewEnvelope(cfg, {
    time: now,
    ...who(req, now),
    operationName: view.path,
    url: `https://${host}${view.path}`,
    title: truncate(view.title || view.path, 200),
    properties: {
      path: view.path,
      referrer: view.referrer,
      referrerHost,
      source: 'beacon',
    },
  });
  return sendEnvelopes(cfg, [envelope], fetchImpl ? { fetchImpl } : {});
}

export interface ChatTurn {
  conversationId: string;
  userMessage: string;
  reply: string;
  greetingId?: string;
  /** The page's Sallie context key, e.g. 'purple-team' */
  context?: string;
  /** The path the visitor was on, e.g. /purple-team */
  page?: string;
  /** The visitor's message number in this conversation (1 = first question) */
  turn?: number;
  /** ok, fallback (provider down), busy (429) or ended (a limit was hit) */
  outcome?: 'ok' | 'fallback' | 'busy' | 'ended';
  endedReason?: string;
}

interface TrackOptions {
  cfg?: IngestionConfig | null;
  now?: Date;
  fetchImpl?: typeof fetch;
}

/**
 * One Sallie turn as a custom event, so the portal can show the conversation.
 * The address is never a property; the country comes from App Insights'
 * geolocation of the truncated network (client_CountryOrRegion).
 */
export async function trackChatTurn(
  req: Request | undefined,
  turn: ChatTurn,
  { cfg = ingestionConfig(), now = new Date(), fetchImpl }: TrackOptions = {}
): Promise<boolean> {
  if (!cfg) return false;
  const identity = req ? who(req, now) : { visitorId: 'anonymous', geoIp: null };
  const properties: Record<string, string> = {
    conversationId: truncate(turn.conversationId, 80),
    userMessage: truncate(turn.userMessage, MAX_MESSAGE),
    reply: truncate(turn.reply, MAX_REPLY),
    outcome: turn.outcome ?? 'ok',
  };
  if (turn.greetingId) properties.greetingId = turn.greetingId;
  if (turn.context) properties.context = turn.context;
  if (turn.page) properties.page = turn.page;
  if (turn.turn) properties.turn = String(turn.turn);
  if (turn.endedReason) properties.endedReason = turn.endedReason;
  const envelope = eventEnvelope(cfg, {
    time: now,
    ...identity,
    operationName: 'POST /api/chat',
    eventName: CHAT_EVENT,
    properties,
  });
  return sendEnvelopes(cfg, [envelope], fetchImpl ? { fetchImpl } : {});
}
