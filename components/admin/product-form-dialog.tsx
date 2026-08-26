'use client';

import { useEffect, useState } from 'react';
import { ImageIcon, Loader2, Plus, Upload, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNostrAuth } from '@/components/auth/nostr-auth-provider';
import { fetchLatestOwnerEvent, useOwnerCatalog, useShopPublish } from '@/hooks/use-shop-admin';
import { uploadToBlossom } from '@/lib/blossom';
import {
  buildProductEvent,
  EMPTY_PRODUCT_FORM,
  parseShippingZone,
  PRODUCT_KIND,
  productEventToFormData,
  SHIPPING_OPTION_KIND,
  validateProductForm,
  type ProductFormData,
  type ProductStatus,
  type ProductVisibility,
} from '@/lib/shop-admin';
import type { NostrEvent } from '@/lib/story-notes';

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the dialog opens in edit mode for this product event. */
  event?: NostrEvent | null;
  /** Called with the signed event after a successful publish. */
  onSaved?: (signed: NostrEvent) => void;
}

/** Currencies offered in the price dropdown (plus any custom current value). */
const CURRENCIES = ['SATS', 'GBP', 'USD', 'EUR', 'BTC'];

const inputDark =
  'border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus-visible:ring-lime-500';

/**
 * Small preview beside each Images row so the owner can tell listings apart
 * at a glance. Hidden until onLoad fires so a bad URL never flashes the
 * broken-image glyph; the error state resets when the URL changes.
 */
function ImageThumb({ url }: { url: string }) {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setErrored(false);
    setLoaded(false);
  }, [url]);
  const trimmed = url.trim();
  const showImage = trimmed !== '' && !errored;

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-gray-700 bg-gray-800">
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary Nostr-hosted preview
        <img
          src={trimmed}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className={loaded ? 'h-full w-full object-cover' : 'hidden'}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
      {!(showImage && loaded) && <ImageIcon className="h-4 w-4 text-gray-500" />}
    </div>
  );
}

/**
 * Add/edit a NIP-99 product listing (kind 30402 + Gamma extensions). Ported
 * from the robotechy.com / edenweeks.art owner dialogs: on edit, the latest
 * version is re-fetched right before publishing so unmanaged tags are merged
 * forward (never clobbered), and the same `d` identifier replaces the old
 * event on the relays.
 */
export function ProductFormDialog({ open, onOpenChange, event, onSaved }: ProductFormDialogProps) {
  const isEdit = Boolean(event);
  const publish = useShopPublish();
  const { signEvent } = useNostrAuth();
  // The owner's shipping zones (kind 30406) for the ships-with checkboxes.
  const { events: zoneEvents } = useOwnerCatalog(SHIPPING_OPTION_KIND);

  const [form, setForm] = useState<ProductFormData>(EMPTY_PRODUCT_FORM);
  const [categoryInput, setCategoryInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  // Reset the form whenever the dialog opens (edit -> hydrate, create -> blank).
  useEffect(() => {
    if (!open) return;
    setForm(event ? productEventToFormData(event) : { ...EMPTY_PRODUCT_FORM });
    setCategoryInput('');
    setError(null);
  }, [open, event]);

  const set = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setImage = (index: number, value: string) =>
    setForm((prev) => ({
      ...prev,
      images: prev.images.map((img, i) => (i === index ? value : img)),
    }));

  const addImage = () => setForm((prev) => ({ ...prev, images: [...prev.images, ''] }));
  const removeImage = (index: number) =>
    setForm((prev) => ({ ...prev, images: prev.images.filter((_, i) => i !== index) }));

  const handleUpload = async (index: number, file: File) => {
    setUploadingIndex(index);
    setError(null);
    try {
      const url = await uploadToBlossom(file, signEvent);
      setImage(index, url);
    } catch (uploadError) {
      console.error('Image upload failed:', uploadError);
      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const addCategory = () => {
    const value = categoryInput.trim();
    if (!value || form.categories.includes(value)) return;
    set('categories', [...form.categories, value]);
    setCategoryInput('');
  };

  const removeCategory = (value: string) =>
    set(
      'categories',
      form.categories.filter((c) => c !== value)
    );

  const toggleZone = (zoneId: string, checked: boolean) =>
    set(
      'shippingRefs',
      checked ? [...form.shippingRefs, zoneId] : form.shippingRefs.filter((id) => id !== zoneId)
    );

  const handleSubmit = async () => {
    const errors = validateProductForm(form);
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Fetch-latest-merge-republish: never build an edit from a stale copy.
      const dTag = form.id?.trim();
      const latest = dTag ? await fetchLatestOwnerEvent(PRODUCT_KIND, dTag) : null;
      const signed = await publish(buildProductEvent(form, latest ?? event ?? undefined));
      onSaved?.(signed);
      onOpenChange(false);
    } catch (publishError) {
      console.error('Failed to publish product:', publishError);
      setError(
        publishError instanceof Error ? publishError.message : 'Could not publish the product.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gray-800 bg-gray-900 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit product' : 'Add a new product'}</DialogTitle>
          <DialogDescription className="text-gray-400">
            {isEdit
              ? 'Update this listing and republish the NIP-99 event (same identifier).'
              : 'Publish a new NIP-99 (kind 30402) product listing to the KnowAll shop.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="product-title" className="text-gray-200">
              Title
            </Label>
            <Input
              id="product-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="KnowAll AI Sticker Pack"
              className={inputDark}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-summary" className="text-gray-200">
              Summary
            </Label>
            <Input
              id="product-summary"
              value={form.summary ?? ''}
              onChange={(e) => set('summary', e.target.value)}
              placeholder="Short tagline shown on the product card"
              className={inputDark}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-description" className="text-gray-200">
              Description
            </Label>
            <Textarea
              id="product-description"
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value)}
              rows={4}
              placeholder="Full description (use **bold** for emphasis)"
              className={inputDark}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="product-price" className="text-gray-200">
                Price
              </Label>
              <Input
                id="product-price"
                inputMode="decimal"
                value={form.priceAmount}
                onChange={(e) => set('priceAmount', e.target.value)}
                placeholder="10000"
                className={inputDark}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-currency" className="text-gray-200">
                Currency
              </Label>
              <Select value={form.priceCurrency} onValueChange={(v) => set('priceCurrency', v)}>
                <SelectTrigger id="product-currency" className={inputDark}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(CURRENCIES.includes(form.priceCurrency)
                    ? CURRENCIES
                    : [...CURRENCIES, form.priceCurrency]
                  ).map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-stock" className="text-gray-200">
                Stock
              </Label>
              <Input
                id="product-stock"
                inputMode="numeric"
                value={form.stock ?? ''}
                onChange={(e) => set('stock', e.target.value)}
                placeholder="Untracked"
                className={inputDark}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-200">Images</Label>
            {form.images.map((image, index) => (
              <div key={index} className="flex items-center gap-2">
                <ImageThumb url={image} />
                <Input
                  aria-label={`Image URL ${index + 1}`}
                  value={image}
                  onChange={(e) => setImage(index, e.target.value)}
                  placeholder="https://…/image.png"
                  className={inputDark}
                />
                <label className="cursor-pointer">
                  {/* sr-only (not `hidden`) keeps the input focusable and
                      operable by keyboard / screen readers. */}
                  <input
                    type="file"
                    accept="image/*"
                    aria-label={`Upload image ${index + 1}`}
                    className="peer sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      // Clear the value so re-selecting the same file (e.g.
                      // after a failed upload) still fires onChange.
                      e.target.value = '';
                      if (file) handleUpload(index, file);
                    }}
                  />
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-gray-700 text-gray-300 hover:border-lime-600 peer-focus-visible:ring-2 peer-focus-visible:ring-lime-500">
                    {uploadingIndex === index ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </span>
                </label>
                {form.images.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove image ${index + 1}`}
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addImage}
              className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add image
            </Button>
            <p className="text-xs text-gray-500">
              Paste a hosted URL or upload — uploads go to Blossom (blossom.primal.net) with a
              kind-24242 authorization signed by your extension.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="product-category" className="text-gray-200">
              Categories
            </Label>
            <div className="flex gap-2">
              <Input
                id="product-category"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCategory();
                  }
                }}
                placeholder="e.g. stickers"
                className={inputDark}
              />
              <Button
                type="button"
                variant="outline"
                onClick={addCategory}
                className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800"
              >
                Add
              </Button>
            </div>
            {form.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {form.categories.map((category) => (
                  <Badge key={category} variant="secondary" className="gap-1">
                    {category}
                    <button
                      type="button"
                      aria-label={`Remove category ${category}`}
                      onClick={() => removeCategory(category)}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              Categories are NIP-99 <code>t</code> tags — they drive the storefront’s hashtag
              filter.
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-gray-200">Ships with</Label>
            {zoneEvents === null ? (
              <p className="text-sm text-gray-500">Loading shipping zones…</p>
            ) : zoneEvents.length === 0 ? (
              <p className="text-sm text-gray-500">
                No shipping zones yet — add them via “Shipping zones” on the shop page.
              </p>
            ) : (
              <div className="space-y-2 rounded-md border border-gray-700 p-3">
                {zoneEvents.map((zoneEvent) => {
                  const zone = parseShippingZone(zoneEvent);
                  if (!zone) return null;
                  const checked = form.shippingRefs.includes(zone.id);
                  return (
                    <label key={zone.id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggleZone(zone.id, value === true)}
                        aria-label={`Toggle shipping zone ${zone.title}`}
                      />
                      <span className="truncate text-gray-200">{zone.title}</span>
                      <span className="ml-auto shrink-0 text-xs text-gray-500">
                        {zone.price.amount} {zone.price.currency}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="product-status" className="text-gray-200">
                Status
              </Label>
              <Select
                value={form.status}
                onValueChange={(value) => set('status', value as ProductStatus)}
              >
                <SelectTrigger id="product-status" className={inputDark}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="sold">Sold out</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-visibility" className="text-gray-200">
                Visibility
              </Label>
              <Select
                value={form.visibility}
                onValueChange={(value) => set('visibility', value as ProductVisibility)}
              >
                <SelectTrigger id="product-visibility" className={inputDark}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="on-sale">On sale</SelectItem>
                  <SelectItem value="pre-order">Pre-order</SelectItem>
                  <SelectItem value="hidden">Hidden (draft)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="product-location" className="text-gray-200">
                Ships from
              </Label>
              <Input
                id="product-location"
                value={form.location ?? ''}
                onChange={(e) => set('location', e.target.value)}
                placeholder="United Kingdom"
                className={inputDark}
              />
            </div>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-gray-700 bg-transparent text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            // Block publishing while an image upload is still in flight so the
            // event can't ship without the uploaded URL.
            disabled={saving || uploadingIndex !== null}
            className="bg-lime-600 font-semibold text-white hover:bg-lime-700"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {uploadingIndex !== null
              ? 'Uploading image…'
              : isEdit
                ? 'Save changes'
                : 'Publish product'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
