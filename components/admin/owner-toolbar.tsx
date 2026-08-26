'use client';

import { useState } from 'react';
import { FolderTree, PackagePlus, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShopOwner } from '@/hooks/use-shop-admin';
import { ProductFormDialog } from '@/components/admin/product-form-dialog';
import { ShippingZonesDialog } from '@/components/admin/shipping-zones-dialog';
import { CollectionsDialog } from '@/components/admin/collections-dialog';

interface OwnerToolbarProps {
  /** Called after the catalog changes (product added) so the grid refreshes. */
  onCatalogChanged?: () => void;
}

/**
 * Store-owner controls shown on the shop page. Rendered only when the
 * signed-in Nostr user is the KnowAll AI npub (`useShopOwner`), so everyone
 * else sees nothing different. Ported from the robotechy.com /
 * edenweeks.art owner toolbars.
 */
export function OwnerToolbar({ onCatalogChanged }: OwnerToolbarProps) {
  const isOwner = useShopOwner();
  const [addOpen, setAddOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);

  if (!isOwner) return null;

  return (
    <div
      data-testid="owner-toolbar"
      className="mb-8 rounded-xl border border-lime-600/40 bg-lime-600/10"
    >
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="text-sm font-semibold text-lime-500">Store owner tools</span>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="bg-lime-600 font-semibold text-white hover:bg-lime-700"
          >
            <PackagePlus className="mr-2 h-4 w-4" />
            Add product
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShippingOpen(true)}
            className="border-gray-700 bg-transparent text-gray-300 hover:border-lime-600 hover:bg-gray-800 hover:text-lime-500"
          >
            <Truck className="mr-2 h-4 w-4" />
            Shipping zones
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCollectionsOpen(true)}
            className="border-gray-700 bg-transparent text-gray-300 hover:border-lime-600 hover:bg-gray-800 hover:text-lime-500"
          >
            <FolderTree className="mr-2 h-4 w-4" />
            Categories &amp; collections
          </Button>
        </div>
      </div>

      {/* Lazy-mount: the dialogs run relay queries on mount, so only mount one
          once it is actually opened. */}
      {addOpen && (
        <ProductFormDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          onSaved={() => onCatalogChanged?.()}
        />
      )}
      {shippingOpen && <ShippingZonesDialog open={shippingOpen} onOpenChange={setShippingOpen} />}
      {collectionsOpen && (
        <CollectionsDialog open={collectionsOpen} onOpenChange={setCollectionsOpen} />
      )}
    </div>
  );
}
