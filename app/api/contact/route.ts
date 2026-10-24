import { NextResponse } from 'next/server';
import { enquiryEmail, enquiryPayloadSchema } from '@/lib/contact';
import { mailConfig, sendMail } from '@/lib/graph-mail';
import { clientIp, consume, isSameOrigin } from '@/lib/rate-limit';

/**
 * Guest enquiries (visitors not signed in with Nostr): emailed to hello@ from
 * Sallie's mailbox, with Reply-To set to the visitor. Signed-in visitors DM
 * the KnowAll AI npub from the browser instead and never reach this route.
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

  const parsed = enquiryPayloadSchema.safeParse(await req.json().catch(() => null));
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
