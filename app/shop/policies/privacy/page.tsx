import type { Metadata } from 'next';
import PolicyLayout, { MessageUsLink } from '@/components/policy-layout';

export const metadata: Metadata = {
  title: 'Privacy Policy | KnowAll AI Shop',
  description:
    'Privacy policy for the KnowAll AI shop — orders over encrypted Nostr DMs, no accounts, no customer database.',
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout title="Privacy Policy">
      <p className="text-lg">
        The shop is built on the Nostr protocol and is deliberately minimal about data: there are no
        shop accounts and no customer database.
      </p>

      <h2 className="text-2xl font-semibold text-white">What goes over Nostr</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          <strong className="text-white">Orders</strong> are sent as end-to-end encrypted direct
          messages to our Nostr key. Relays carry the encrypted events but cannot read the contents
          — including your delivery address. Contact-form messages are covered under &ldquo;A note
          on Nostr&rdquo; below.
        </li>
        <li>
          <strong className="text-white">Public activity</strong> — replies and zaps you post are
          public Nostr events signed by your key, visible to anyone, and outside this site&apos;s
          control once published.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-white">What we use your details for</h2>
      <p>
        The delivery details in an order are used solely to fulfil that order. We delete address
        data once delivery is confirmed (plus any statutory period we&apos;re required to keep
        records for), and we never share it or use it for anything else — no mailing lists, no third
        parties.
      </p>

      <h2 className="text-2xl font-semibold text-white">Payments</h2>
      <p>
        Payments are Bitcoin Lightning invoices. We never see card numbers or bank details — there
        are none involved.
      </p>

      <h2 className="text-2xl font-semibold text-white">A note on Nostr</h2>
      <p>
        Contact-form messages from visitors who aren&apos;t signed in with Nostr are emailed to
        hello@knowall.ai through our Microsoft 365 tenant, where we keep them as ordinary business
        email. If you&apos;re signed in with Nostr, your message is also sent as an end-to-end
        encrypted direct message to our Nostr key over public relays: relays (which we don&apos;t
        operate) can see that an encrypted message passed between two keys and when, but not its
        contents. Reviews, replies and zaps are public Nostr events signed by their authors and
        visible network-wide.
      </p>

      <h2 className="text-2xl font-semibold text-white">Website visits and Sallie</h2>
      <p>
        Across www.knowall.ai we count visits without cookies or anything else stored on your
        device, so there is no consent banner. When a page loads, your browser tells our own server
        which page it was and, on arrival, which site linked you here (without its query string).
        The server turns your IP address and browser into an anonymous code using that day&apos;s
        salt, a secret key that changes every day and is only held in memory for the day, so a visit
        can be counted once but you can&apos;t be followed from day to day, and the code can&apos;t
        be turned back into your address. Your full IP address isn&apos;t kept for this or sent on:
        only its network part goes to Microsoft Azure Application Insights, in the UK, to work out
        the country and city, and Application Insights then discards it. These records are kept for
        90 days.
      </p>
      <p>
        If your browser sends <strong className="text-white">Do Not Track</strong> or{' '}
        <strong className="text-white">Global Privacy Control</strong>, your visits aren&apos;t
        counted at all.
      </p>
      <p>
        Conversations with Sallie, our AI assistant, are kept so we can follow up and improve her:
        what you wrote and her replies, the page you were on and the country you were in, for 90
        days. The website server also keeps its own chat log, with your IP address, to stop abuse;
        entries in it are deleted after 30 days. Please don&apos;t share anything sensitive with
        her. With Do Not Track or Global Privacy Control on, the conversation is kept without a
        location or visitor code. Email hello@knowall.ai to have a conversation deleted.
      </p>

      <h2 className="text-2xl font-semibold text-white">Questions</h2>
      <p>
        <MessageUsLink>Message us on Nostr</MessageUsLink> or email{' '}
        <a href="mailto:hello@knowall.ai" className="underline hover:text-white">
          hello@knowall.ai
        </a>{' '}
        if you have any questions about your data.
      </p>
    </PolicyLayout>
  );
}
