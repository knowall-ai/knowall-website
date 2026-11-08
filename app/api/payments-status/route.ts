import { createPaymentsStatusCache, DEFAULT_SHOP_LIGHTNING_ADDRESS } from '@/lib/payments-status';

/**
 * Whether Lightning payments are currently available, for the checkout panel
 * (lib/payments-status.ts). Probes the shop's Lightning Address at most once a
 * minute, so it is cheap to poll.
 */
export const dynamic = 'force-dynamic';

const getPaymentsStatus = createPaymentsStatusCache({
  address: () => process.env.SHOP_LIGHTNING_ADDRESS?.trim() || DEFAULT_SHOP_LIGHTNING_ADDRESS,
});

export async function GET() {
  return Response.json(await getPaymentsStatus(), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
