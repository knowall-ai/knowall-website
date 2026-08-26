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
          <strong className="text-white">Orders and messages</strong> are sent as end-to-end
          encrypted direct messages to our Nostr key. Relays carry the encrypted events but cannot
          read the contents — including your delivery address.
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
        Messages sent through this site travel as encrypted direct messages over public Nostr
        relays. The content is end-to-end encrypted, but relays (which we don&apos;t operate) can
        see that an encrypted message passed between two keys and when. Reviews, replies and zaps
        are public Nostr events signed by their authors and visible network-wide.
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
