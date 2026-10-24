import { LIMITS } from '@/lib/rate-limit';
import { BodyTooLargeError, isAllowedOrigin, readTextWithLimit } from '@/lib/request-guards';

/**
 * Request validation for /api/chat. The server's own prompt is the only
 * system message the model ever sees: the client may send only `user` and
 * `assistant` turns, and anything else is refused.
 */

/**
 * The client resends the whole conversation each turn, so this has to fit a
 * full-length one: up to the conversation cap of visitor turns, each answered
 * by a reply of at most 500 tokens (roughly 2-3 KB).
 */
export const MAX_CHAT_BODY_BYTES = 128 * 1024;
export const MAX_MESSAGE_CHARS = 4000;
/** Greeting + visitor turns + replies, with room for the over-cap turn that triggers the sign-off. */
export const maxChatMessages = () => LIMITS.messagesPerConversation() * 2 + 4;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** The other fields are checked where they're used (conversationId, greetingId, context). */
export type ChatRequestBody = Record<string, any>;

export type ChatRequestResult =
  { ok: true; body: ChatRequestBody; messages: ChatMessage[] } | { ok: false; response: Response };

function reject(status: number, error: string): { ok: false; response: Response } {
  return { ok: false, response: Response.json({ error }, { status }) };
}

export async function parseChatRequest(req: Request): Promise<ChatRequestResult> {
  if (!isAllowedOrigin(req)) return reject(403, 'Chat is only available on the site');

  let raw: string;
  try {
    raw = await readTextWithLimit(req, MAX_CHAT_BODY_BYTES);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return reject(413, 'Request body is too large');
    return reject(400, 'Could not read the request body');
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return reject(400, 'Request body must be valid JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return reject(400, 'Request body must be a JSON object');
  }
  const record = body as ChatRequestBody;

  const input = record.messages ?? [];
  if (!Array.isArray(input)) return reject(400, 'messages must be an array');
  if (input.length > maxChatMessages()) return reject(413, 'Too many messages');

  const messages: ChatMessage[] = [];
  for (const m of input) {
    if (!m || typeof m !== 'object') return reject(400, 'Each message must be an object');
    const { role, content } = m as { role?: unknown; content?: unknown };
    if (role !== 'user' && role !== 'assistant') {
      return reject(400, 'Only user and assistant messages are accepted');
    }
    if (typeof content !== 'string') return reject(400, 'Message content must be a string');
    if (content.length > MAX_MESSAGE_CHARS) return reject(413, 'A message is too long');
    messages.push({ role, content });
  }

  return { ok: true, body: record, messages };
}
