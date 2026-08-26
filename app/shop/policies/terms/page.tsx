import type { Metadata } from 'next';
import PolicyLayout, { MessageUsLink } from '@/components/policy-layout';

export const metadata: Metadata = {
  title: 'Terms of Service | KnowAll AI Shop',
  description: 'Terms of service for the KnowAll AI shop.',
};

export default function TermsOfServicePage() {
  return (
    <PolicyLayout title="Terms of Service">
      <p className="text-lg">
        These terms cover purchases from the KnowAll AI shop. Buying from the shop means you accept
        them.
      </p>

      <h2 className="text-2xl font-semibold text-white">Orders and payment</h2>
      <ul className="list-disc pl-6 space-y-2">
        <li>Prices are shown on each listing in sats.</li>
        <li>
          Orders are arranged person-to-person by Nostr direct message. Payment is by Bitcoin
          Lightning invoice, and an order is confirmed once its invoice is paid.
        </li>
        <li>
          Shipping costs are published with each listing by zone (see the Shipping Policy) and added
          to your invoice; we&apos;ll confirm the total by direct message before you pay.
        </li>
      </ul>

      <h2 className="text-2xl font-semibold text-white">Community content</h2>
      <p>
        Replies, reviews and zaps are public Nostr events signed by their authors. Be kind; we may
        hide abusive content from this site&apos;s pages, though we can&apos;t remove events from
        the wider Nostr network.
      </p>

      <h2 className="text-2xl font-semibold text-white">Liability</h2>
      <p>
        Nothing in these terms affects your local statutory rights. Beyond what the law requires,
        KnowAll AI&apos;s liability is limited to the amount you paid for your order.
      </p>

      <h2 className="text-2xl font-semibold text-white">Contact</h2>
      <p>
        Questions about these terms? <MessageUsLink>Message us on Nostr</MessageUsLink> or email{' '}
        <a href="mailto:hello@knowall.ai" className="underline hover:text-white">
          hello@knowall.ai
        </a>
        .
      </p>
    </PolicyLayout>
  );
}
