import { NextResponse } from 'next/server';
import { enquiryEmail, enquiryPayloadSchema } from '@/lib/contact';
import { mailConfig, sendMail } from '@/lib/graph-mail';
import { clientIp, consume, isSameOrigin } from '@/lib/rate-limit';

/** Largest request we'll read: the form's caps fit comfortably inside this. */
const MAX_BODY_BYTES = 16 * 1024;

/**
 * Read the body as text, giving up (null) once it passes `limit` bytes, so an
 * oversized post never gets buffered or parsed in full.
 */
async function readBody(req: Request, limit: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > limit) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Enquiries emailed to hello@ from Sallie's mailbox, with Reply-To set to the
 * visitor: every guest message, plus a copy of each signed-in visitor's Nostr
 * DM (whose npub the email marks as unverified).
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = consume('contact', clientIp(req));
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many messages. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter ?? 600) } }
    );
  }

  const raw = await readBody(req, MAX_BODY_BYTES);
  if (raw === null) {
    return NextResponse.json({ error: 'Message too long.' }, { status: 413 });
  }
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    // falls through to the validation error below
  }
  const parsed = enquiryPayloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please check the form and try again.' }, { status: 400 });
  }

  // Bots that fill the hidden field get a quiet "success" and no email.
  if (parsed.data.website) return NextResponse.json({ ok: true });

  const config = mailConfig();
  if (!config) {
    console.error('Contact form: CONTACT_MAIL_* settings are missing; enquiry not sent.');
    return NextResponse.json(
      { error: 'Our contact form is unavailable right now. Please email hello@knowall.ai.' },
      { status: 503 }
    );
  }

  const { subject, text } = enquiryEmail(parsed.data, req.headers.get('referer') ?? undefined);
  try {
    await sendMail(config, {
      subject,
      text,
      replyTo: { name: parsed.data.name, address: parsed.data.email },
    });
  } catch (err) {
    console.error('Contact form: send failed', err);
    return NextResponse.json(
      { error: 'Could not send your message. Please email hello@knowall.ai.' },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true });
}
