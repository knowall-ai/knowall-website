'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useShopPublish } from '@/hooks/use-shop-admin';
import { buildDeleteEvent, PRODUCT_KIND } from '@/lib/shop-admin';

interface DeleteListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Merchant pubkey (hex) that authored the listing. */
  pubkey: string;
  /** Addressable `d` identifier of the listing to remove. */
  dTag: string;
  /** Product title shown in the confirmation copy. */
  title: string;
  /** Called after a successful deletion (optimistic removal / navigation). */
  onDeleted?: () => void;
}

/**
 * Confirms and performs a NIP-09 product removal: one kind-5 deletion request
 * referencing the product's addressable coordinate (`a = 30402:<pubkey>:<d>`),
 * so relays drop every version sharing that `d` tag. Ported from the
 * robotechy.com / edenweeks.art delete dialogs.
 */
export function DeleteListingDialog({
  open,
  onOpenChange,
  pubkey,
  dTag,
  title,
  onDeleted,
}: DeleteListingDialogProps) {
  const publish = useShopPublish();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await publish(buildDeleteEvent(PRODUCT_KIND, pubkey, dTag, 'Product deleted'));
      onOpenChange(false);
      onDeleted?.();
    } catch (deleteError) {
      console.error('Failed to delete product:', deleteError);
      setError(
        deleteError instanceof Error ? deleteError.message : 'Could not remove the product.'
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-gray-800 bg-gray-900 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this product?</AlertDialogTitle>
          <AlertDialogDescription className="text-gray-400">
            This publishes a Nostr deletion request (NIP-09) for “{title}”. Relays will drop the
            listing. This cannot be undone, though you can always publish the product again.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800 hover:text-white">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDelete();
            }}
            disabled={deleting}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Remove product
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
