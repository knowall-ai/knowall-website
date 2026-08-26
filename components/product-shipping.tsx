'use client';

import { useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SHOP_RELAYS } from '@/lib/nostr';
import { queryRelays } from '@/lib/relay';
import { formatPrice } from '@/lib/nip99';
import {
  dedupeByDTag,
  parseShippingZone,
  SHIPPING_OPTION_KIND,
  type ShippingZone,
} from '@/lib/shop-admin';

interface ProductShippingProps {
  /** Merchant pubkey (hex) whose shipping zones are referenced. */
  pubkey: string;
  /** Zone d-tags from the listing's `shipping_option` refs, in display order. */
  zoneIds: string[];
}

/**
 * Public P&P block for a product page: resolves the listing's
 * `shipping_option` refs (Gamma kind 30406, e.g. "30406:<pubkey>:ship-uk")
 * against the merchant's shipping-zone events and lists each zone with its
 * price — "United Kingdom £2.50", "Rest of World £7.50" — formatted the same
 * way as the item price. Renders nothing when the listing references no
 * zones or none could be resolved.
 */
export default function ProductShipping({ pubkey, zoneIds }: ProductShippingProps) {
  const [zones, setZones] = useState<ShippingZone[] | null>(null);

  useEffect(() => {
    if (zoneIds.length === 0) {
      setZones([]);
      return;
    }
    let active = true;
    queryRelays(SHOP_RELAYS, [
      { kinds: [SHIPPING_OPTION_KIND], authors: [pubkey], '#d': zoneIds, limit: 50 },
    ]).then((events) => {
      if (!active) return;
      const latest = dedupeByDTag(
        events.filter((event) => event.kind === SHIPPING_OPTION_KIND && event.pubkey === pubkey)
      );
      const byId = new Map(
        latest
          .map(parseShippingZone)
          .filter((zone): zone is ShippingZone => zone !== null)
          .map((zone) => [zone.id, zone])
      );
      // Preserve the listing's reference order.
      setZones(zoneIds.map((id) => byId.get(id)).filter((zone): zone is ShippingZone => !!zone));
    });
    return () => {
      active = false;
    };
  }, [pubkey, zoneIds]);

  if (zoneIds.length === 0 || (zones !== null && zones.length === 0)) return null;

  return (
    <section data-testid="product-shipping" className="rounded-lg border border-gray-800 p-4">
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
        <Truck className="h-4 w-4 text-lime-500" aria-hidden="true" />
        Shipping
      </h2>
      {zones === null ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-2/3 bg-gray-800" />
          <Skeleton className="h-4 w-1/2 bg-gray-800" />
        </div>
      ) : (
        <ul className="space-y-1.5">
          {zones.map((zone) => {
            const amount = Number(zone.price.amount);
            const price =
              Number.isFinite(amount) && amount >= 0
                ? formatPrice({ amount, currency: zone.price.currency })
                : null;
            return (
              <li
                key={zone.id}
                className="flex items-baseline justify-between gap-4 text-sm text-gray-300"
              >
                <span>{zone.title}</span>
                <span className="shrink-0 font-medium text-white">{price ?? '—'}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
