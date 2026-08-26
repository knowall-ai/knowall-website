'use client';

import { useState } from 'react';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useShopOwner, fetchLatestOwnerEvent } from '@/hooks/use-shop-admin';
import { KNOWALL_PUBKEY } from '@/lib/nostr';
import { PRODUCT_KIND } from '@/lib/shop-admin';
import { ProductFormDialog } from '@/components/admin/product-form-dialog';
import { DeleteListingDialog } from '@/components/admin/delete-listing-dialog';
import type { NostrEvent } from '@/lib/story-notes';

interface OwnerListingControlsProps {
  /** Merchant pubkey (hex) that authored the listing. */
  pubkey: string;
  /** Addressable `d` identifier of the listing. */
  dTag: string;
  /** Product title, for confirmation copy. */
  title: string;
  /** Compact icon buttons (grid cards) vs labelled buttons (product page). */
  variant?: 'compact' | 'full';
  /** Called after a successful save (edit republished). */
  onSaved?: (signed: NostrEvent) => void;
  /** Called after a successful deletion (optimistic removal / navigation). */
  onDeleted?: () => void;
}

/**
 * Edit / Remove controls for a single product, rendered only for the store
 * owner. Edit fetches the latest event version from the relays first so the
 * form (and its merge-republish) never starts from a stale copy.
 */
export function OwnerListingControls({
  pubkey,
  dTag,
  title,
  variant = 'full',
  onSaved,
  onDeleted,
}: OwnerListingControlsProps) {
  const isOwner = useShopOwner();
  const [editEvent, setEditEvent] = useState<NostrEvent | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the KnowAll catalog is manageable: never offer controls for a listing
  // authored by someone else (the extension couldn't replace it anyway).
  if (!isOwner || pubkey !== KNOWALL_PUBKEY) return null;

  const startEdit = async () => {
    setLoadingEdit(true);
    setError(null);
    try {
      const latest = await fetchLatestOwnerEvent(PRODUCT_KIND, dTag);
      if (!latest) {
        setError('Could not load the latest version of this listing. Try again.');
        return;
      }
      setEditEvent(latest);
      setEditOpen(true);
    } catch (fetchError) {
      console.error('Failed to fetch the latest listing version:', fetchError);
      setError('Could not load the latest version of this listing. Try again.');
    } finally {
      setLoadingEdit(false);
    }
  };

  const compact = variant === 'compact';

  return (
    <div data-testid="owner-listing-controls" className={compact ? 'flex gap-1' : 'space-y-2'}>
      <div
        className={
          compact
            ? 'contents'
            : 'flex flex-wrap items-center gap-3 rounded-lg border border-lime-600/40 bg-lime-600/10 p-3'
        }
      >
        {!compact && <span className="text-sm font-semibold text-lime-500">Owner</span>}
        <Button
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          aria-label={`Edit ${title}`}
          onClick={startEdit}
          disabled={loadingEdit}
          className="border-gray-700 bg-transparent text-gray-300 hover:border-lime-600 hover:bg-gray-800 hover:text-lime-500"
        >
          {loadingEdit ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Pencil className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
          )}
          {!compact && 'Edit product'}
        </Button>
        <Button
          variant="outline"
          size={compact ? 'icon' : 'sm'}
          aria-label={`Remove ${title}`}
          onClick={() => setDeleteOpen(true)}
          className="border-red-900 bg-transparent text-red-400 hover:border-red-600 hover:bg-red-950 hover:text-red-300"
        >
          <Trash2 className={compact ? 'h-4 w-4' : 'mr-2 h-4 w-4'} />
          {!compact && 'Remove'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}

      {/* Lazy-mount so the form/dialog only initialise when opened. */}
      {editOpen && (
        <ProductFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          event={editEvent}
          onSaved={onSaved}
        />
      )}
      {deleteOpen && (
        <DeleteListingDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          pubkey={pubkey}
          dTag={dTag}
          title={title}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}
