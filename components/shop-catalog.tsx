'use client';

import { useState } from 'react';
import ShopListings from '@/components/shop-listings';
import { OwnerToolbar } from '@/components/admin/owner-toolbar';

/**
 * The shop page's catalog area: the owner toolbar (only visible to the
 * signed-in KnowAll npub) above the public listings grid. When the owner
 * publishes a new product the refresh token bumps, re-querying the relays so
 * the grid picks it up without a manual reload.
 */
export default function ShopCatalog() {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <>
      <OwnerToolbar onCatalogChanged={() => setRefreshToken((token) => token + 1)} />
      <ShopListings refreshToken={refreshToken} />
    </>
  );
}
