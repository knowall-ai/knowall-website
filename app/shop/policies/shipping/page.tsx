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

      <h2 className="text-2xl font-semibold text-white">Where we ship</h2>
      <p>We ship worldwide. Standard shipping zones and costs:</p>
      <ul className="list-disc pl-6 space-y-1">
        <li>United Kingdom — £2.50</li>
        <li>Europe — £4.50</li>
        <li>Rest of world — £7.50</li>
      </ul>
      <p>
        Shipping is paid in sats at the day&apos;s rate as part of your Lightning invoice. The same
        zones are published alongside each listing on Nostr, and we&apos;ll confirm the total by
        direct message before you pay. If you&apos;re not sure we can reach you,{' '}
        <MessageUsLink>message us</MessageUsLink> and we&apos;ll see what we can arrange.
      </p>

      <h2 className="text-2xl font-semibold text-white">Processing time</h2>
      <p>
        Orders are usually dispatched within 5 working days of payment. We&apos;ll confirm dispatch
        by direct message.
      </p>

      <h2 className="text-2xl font-semibold text-white">Delivery times</h2>
      <p>
        Once dispatched, delivery depends on your location. UK orders typically arrive within a few
        days; international orders can take one to three weeks. Tracking details are shared by
        direct message where available.
      </p>

      <h2 className="text-2xl font-semibold text-white">Questions</h2>
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
