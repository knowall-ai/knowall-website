'use client';

import { useEffect, useState } from 'react';
import { FolderTree, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useOwnerCatalog, useShopPublish } from '@/hooks/use-shop-admin';
import { KNOWALL_PUBKEY } from '@/lib/nostr';
import { parseListing } from '@/lib/nip99';
import {
  buildCollectionEvent,
  buildDeleteEvent,
  COLLECTION_KIND,
  collectionEventToFormData,
  EMPTY_COLLECTION_FORM,
  getDTag,
  parseCollection,
  PRODUCT_KIND,
  validateCollectionForm,
  type CollectionFormData,
} from '@/lib/shop-admin';
import type { NostrEvent } from '@/lib/story-notes';

interface CollectionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const inputDark =
  'border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus-visible:ring-lime-500';

/**
 * Manage categories & collections — the shop's Gamma Markets kind-30405
 * taxonomy. A collection groups products via addressable `a` refs
 * (`30402:<pubkey>:<d>`); free-text `t` categories live on each product and
 * are edited in the product dialog. Ported from robotechy/edenweeks.art.
 */
export function CollectionsDialog({ open, onOpenChange }: CollectionsDialogProps) {
  const publish = useShopPublish();
  const { events: collections, upsert, remove } = useOwnerCatalog(COLLECTION_KIND);
  const { events: products } = useOwnerCatalog(PRODUCT_KIND);

  const [form, setForm] = useState<CollectionFormData>(EMPTY_COLLECTION_FORM);
  const [editing, setEditing] = useState<NostrEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_COLLECTION_FORM);
      setEditing(null);
      setError(null);
    }
  }, [open]);

  const set = <K extends keyof CollectionFormData>(key: K, value: CollectionFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const startEdit = (event: NostrEvent) => {
    const data = collectionEventToFormData(event);
    if (!data) return;
    setEditing(event);
    setForm(data);
    setError(null);
  };

  const resetForm = () => {
    setEditing(null);
    setForm(EMPTY_COLLECTION_FORM);
  };

  const toggleProduct = (productId: string, checked: boolean) =>
    set(
      'productIds',
      checked ? [...form.productIds, productId] : form.productIds.filter((id) => id !== productId)
    );

  const handleSave = async () => {
    const errors = validateCollectionForm(form);
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const signed = await publish(
        buildCollectionEvent(form, KNOWALL_PUBKEY, editing ?? undefined)
      );
      upsert(signed);
      resetForm();
    } catch (saveError) {
      console.error('Failed to save collection:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save the collection.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event: NostrEvent) => {
    const dTag = getDTag(event);
    if (!dTag) return;
    setDeletingId(dTag);
    setError(null);
    try {
      await publish(buildDeleteEvent(COLLECTION_KIND, event.pubkey, dTag, 'Collection deleted'));
      remove(dTag);
      // Compare by addressable `d` id, not object identity.
      if (editing && getDTag(editing) === dTag) resetForm();
    } catch (deleteError) {
      console.error('Failed to delete collection:', deleteError);
      setError(
        deleteError instanceof Error ? deleteError.message : 'Could not delete the collection.'
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gray-800 bg-gray-900 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5 text-lime-500" /> Categories &amp; collections
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Organise products into collections (Gamma Markets kind 30405). Free-text categories
            (hashtags) are edited per product in the product dialog.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-200">Your collections</h3>
          {collections === null ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : collections.length > 0 ? (
            <ul className="divide-y divide-gray-800 rounded-md border border-gray-800">
              {collections.map((event) => {
                const collection = parseCollection(event);
                if (!collection) return null;
                return (
                  <li key={event.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{collection.title}</p>
                      <p className="text-xs text-gray-500">
                        {collection.products.length} product(s)
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${collection.title}`}
                        onClick={() => startEdit(event)}
                        className="text-gray-300 hover:bg-gray-800 hover:text-lime-500"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${collection.title}`}
                        onClick={() => handleDelete(event)}
                        disabled={deletingId === collection.id}
                        className="text-gray-300 hover:bg-red-950 hover:text-red-400"
                      >
                        {deletingId === collection.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">No collections yet.</p>
          )}
        </div>

        <div className="space-y-4 rounded-md border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-200">
            {editing ? 'Edit collection' : 'New collection'}
          </h3>
          <div className="space-y-2">
            <Label htmlFor="collection-title" className="text-gray-200">
              Title
            </Label>
            <Input
              id="collection-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="Stickers"
              className={inputDark}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-description" className="text-gray-200">
              Description
            </Label>
            <Textarea
              id="collection-description"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={2}
              className={inputDark}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-gray-200">Products in this collection</Label>
            {products === null ? (
              <p className="text-sm text-gray-500">Loading products…</p>
            ) : products.length > 0 ? (
              <ScrollArea className="h-40 rounded-md border border-gray-800 p-2">
                <div className="space-y-2">
                  {products.map((event) => {
                    const product = parseListing(event);
                    if (!product) return null;
                    const checked = form.productIds.includes(product.dTag);
                    return (
                      <label
                        key={product.dTag}
                        className="flex cursor-pointer items-center gap-2 text-sm text-gray-200"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => toggleProduct(product.dTag, value === true)}
                          aria-label={`Toggle ${product.title}`}
                        />
                        <span className="truncate">{product.title}</span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-sm text-gray-500">No products to add yet.</p>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-400">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            {editing && (
              <Button
                variant="ghost"
                onClick={resetForm}
                className="text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                Cancel edit
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-lime-600 font-semibold text-white hover:bg-lime-700"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editing ? 'Save collection' : 'Create collection'}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
