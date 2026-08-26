'use client';

import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2, Truck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOwnerCatalog, useShopPublish } from '@/hooks/use-shop-admin';
import {
  buildDeleteEvent,
  buildShippingZoneEvent,
  EMPTY_SHIPPING_FORM,
  getDTag,
  parseShippingZone,
  SHIPPING_OPTION_KIND,
  shippingZoneEventToFormData,
  validateShippingZoneForm,
  type ShippingService,
  type ShippingZoneFormData,
} from '@/lib/shop-admin';
import type { NostrEvent } from '@/lib/story-notes';

interface ShippingZonesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CURRENCIES = ['SATS', 'GBP', 'USD', 'EUR', 'BTC'];

const inputDark =
  'border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus-visible:ring-lime-500';

/**
 * Manage shipping zones — full CRUD over the owner's Gamma Markets kind-30406
 * shipping options (zone name, destination countries, price, service,
 * carrier). Products reference these zones via `shipping_option` tags, and
 * the public product page renders them as its P&P block.
 */
export function ShippingZonesDialog({ open, onOpenChange }: ShippingZonesDialogProps) {
  const publish = useShopPublish();
  const { events, upsert, remove } = useOwnerCatalog(SHIPPING_OPTION_KIND);

  const [form, setForm] = useState<ShippingZoneFormData>(EMPTY_SHIPPING_FORM);
  const [countriesText, setCountriesText] = useState('');
  const [editing, setEditing] = useState<NostrEvent | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_SHIPPING_FORM);
      setCountriesText('');
      setEditing(null);
      setError(null);
    }
  }, [open]);

  const set = <K extends keyof ShippingZoneFormData>(key: K, value: ShippingZoneFormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const startEdit = (event: NostrEvent) => {
    const data = shippingZoneEventToFormData(event);
    if (!data) return;
    setEditing(event);
    setForm(data);
    setCountriesText(data.countries.join(', '));
    setError(null);
  };

  const resetForm = () => {
    setEditing(null);
    setForm(EMPTY_SHIPPING_FORM);
    setCountriesText('');
  };

  const handleSave = async () => {
    const data: ShippingZoneFormData = {
      ...form,
      countries: countriesText
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    };
    const errors = validateShippingZoneForm(data);
    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const signed = await publish(buildShippingZoneEvent(data, editing ?? undefined));
      upsert(signed);
      resetForm();
    } catch (saveError) {
      console.error('Failed to save shipping zone:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Could not save the zone.');
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
      await publish(
        buildDeleteEvent(SHIPPING_OPTION_KIND, event.pubkey, dTag, 'Shipping zone deleted')
      );
      remove(dTag);
      // Compare by addressable `d` id, not object identity — refetch can
      // return new event objects for the same zone.
      if (editing && getDTag(editing) === dTag) resetForm();
    } catch (deleteError) {
      console.error('Failed to delete shipping zone:', deleteError);
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the zone.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-x-hidden border-gray-800 bg-gray-900 text-white sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-lime-500" /> Shipping zones
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Manage delivery zones, destination countries and costs (Gamma Markets kind 30406).
            Products reference these zones, and the product page shows them as P&amp;P.
          </DialogDescription>
        </DialogHeader>

        {/* Existing zones */}
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold text-gray-200">Your shipping zones</h3>
          {events === null ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : events.length > 0 ? (
            <ul className="divide-y divide-gray-800 overflow-hidden rounded-md border border-gray-800">
              {events.map((event) => {
                const zone = parseShippingZone(event);
                if (!zone) return null;
                const countriesLabel = zone.countries.join(', ') || 'no destinations';
                return (
                  <li key={event.id} className="flex items-center justify-between gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium" title={zone.title}>
                        {zone.title}
                      </p>
                      <p className="text-xs text-gray-500">
                        {zone.price.amount} {zone.price.currency} · {zone.service}
                        {zone.carrier ? ` · ${zone.carrier}` : ''}
                      </p>
                      <p className="wrap-break-word text-xs text-gray-500" title={countriesLabel}>
                        {countriesLabel}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${zone.title}`}
                        onClick={() => startEdit(event)}
                        className="text-gray-300 hover:bg-gray-800 hover:text-lime-500"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${zone.title}`}
                        onClick={() => handleDelete(event)}
                        disabled={deletingId === zone.id}
                        className="text-gray-300 hover:bg-red-950 hover:text-red-400"
                      >
                        {deletingId === zone.id ? (
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
            <p className="text-sm text-gray-500">No shipping zones yet.</p>
          )}
        </div>

        {/* Editor */}
        <div className="min-w-0 space-y-4 rounded-md border border-gray-800 p-4">
          <h3 className="text-sm font-semibold text-gray-200">
            {editing ? 'Edit shipping zone' : 'Add shipping zone'}
          </h3>
          <div className="space-y-2">
            <Label htmlFor="zone-title" className="text-gray-200">
              Zone name
            </Label>
            <Input
              id="zone-title"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="United Kingdom"
              className={inputDark}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="zone-price" className="text-gray-200">
                Cost
              </Label>
              <Input
                id="zone-price"
                inputMode="decimal"
                value={form.priceAmount}
                onChange={(e) => set('priceAmount', e.target.value)}
                placeholder="2.50"
                className={inputDark}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="zone-currency" className="text-gray-200">
                Currency
              </Label>
              <Select value={form.priceCurrency} onValueChange={(v) => set('priceCurrency', v)}>
                <SelectTrigger id="zone-currency" className={inputDark}>
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
              <Label htmlFor="zone-service" className="text-gray-200">
                Service
              </Label>
              <Select
                value={form.service}
                onValueChange={(value) => set('service', value as ShippingService)}
              >
                <SelectTrigger id="zone-service" className={inputDark}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="express">Express</SelectItem>
                  <SelectItem value="overnight">Overnight</SelectItem>
                  <SelectItem value="pickup">Pickup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-countries" className="text-gray-200">
              Destination countries (ISO codes)
            </Label>
            <Input
              id="zone-countries"
              value={countriesText}
              onChange={(e) => setCountriesText(e.target.value)}
              placeholder="GB, IE, US"
              className={inputDark}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zone-carrier" className="text-gray-200">
              Carrier (optional)
            </Label>
            <Input
              id="zone-carrier"
              value={form.carrier ?? ''}
              onChange={(e) => set('carrier', e.target.value)}
              placeholder="Royal Mail"
              className={inputDark}
            />
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
              {editing ? 'Save shipping zone' : 'Add shipping zone'}
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
