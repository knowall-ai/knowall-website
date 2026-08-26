import type { Metadata } from 'next';
import PolicyLayout, { MessageUsLink } from '@/components/policy-layout';

export const metadata: Metadata = {
  title: 'Refund Policy | KnowAll AI Shop',
  description: 'Refund and returns policy for the KnowAll AI shop.',
};

export default function RefundPolicyPage() {
  return (
    <PolicyLayout title="Refund Policy">
      <p className="text-lg">
        We want you to be happy with what you buy. If something isn&apos;t right, let&apos;s sort it
        out.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Damaged in transit</h2>
      <p>
        If your order arrives damaged, <MessageUsLink>message us</MessageUsLink> within 7 days of
        delivery with photos of the item and the packaging. We&apos;ll offer a replacement or a full
        refund.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Faulty items</h2>
      <p>
        If an item is faulty, the fix is on us: we&apos;ll replace it or refund in full, including
        reasonable return postage. The change-of-mind conditions below don&apos;t apply to faulty
        goods, and your local statutory rights are unaffected.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Returns</h2>
      <p>
        Changed your mind? Physical goods can be returned within 14 days of delivery in their
        original condition. Return postage is the buyer&apos;s responsibility, and we recommend a
        tracked service — the refund is issued once the item arrives back safely.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">How refunds are paid</h2>
      <p>
        Refunds are returned the way you paid. Orders are paid by Bitcoin Lightning invoice, so
        we&apos;ll ask for a Lightning invoice or address and refund your sats at the day&apos;s
        rate.
      </p>

      <h2 className="text-2xl font-semibold mt-8 mb-4 text-white">Questions</h2>
      <p>
        <MessageUsLink>Message us on Nostr</MessageUsLink> or email{' '}
        <a href="mailto:sallie@knowall.ai" className="underline hover:text-white">
          sallie@knowall.ai
        </a>
        .
      </p>
    </PolicyLayout>
  );
}
