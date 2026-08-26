import type { Metadata } from 'next';
import PolicyLayout, { MessageUsLink } from '@/components/policy-layout';

export const metadata: Metadata = {
  title: 'Shipping Policy | KnowAll AI Shop',
  description: 'Shipping policy for the KnowAll AI shop — merch dispatched from the UK.',
};

export default function ShippingPolicyPage() {
  return (
    <PolicyLayout title="Shipping Policy">
      <p className="text-lg">
        Every order is packed by hand and currently dispatched from the UK. Orders are arranged
        person-to-person over Nostr, so shipping is agreed with you before you pay.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Where we ship</h2>
      <p>
        Shipping cost for your country is confirmed by direct message before we send your Lightning
        invoice. If you&apos;re not sure we can reach you, <MessageUsLink>message us</MessageUsLink>{' '}
        and we&apos;ll see what we can arrange.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Processing time</h2>
      <p>
        Orders are usually dispatched within 5 working days of payment. We&apos;ll confirm dispatch
        by direct message.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Delivery times</h2>
      <p>
        Once dispatched, delivery depends on your location. UK orders typically arrive within a few
        days; international orders can take one to three weeks. Tracking details are shared by
        direct message where available.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Questions</h2>
      <p>
        Anything unclear? <MessageUsLink>Message us on Nostr</MessageUsLink> or email{' '}
        <a href="mailto:sallie@knowall.ai" className="underline hover:text-white">
          sallie@knowall.ai
        </a>
        .
      </p>
    </PolicyLayout>
  );
}
