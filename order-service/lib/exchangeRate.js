/**
 * BTC exchange rates for server-side order pricing — a port of the website's
 * lib/exchange-rate.ts so the service converts fiat prices with the SAME rate
 * source the buyer's checkout used: the average of CoinGecko, Kraken and
 * Coinbase (any subset that responds), cached for 5 minutes.
 *
 * Deliberate difference from the website: there are NO hard-coded fallback
 * prices. A stale guess is fine for a browser estimate but not for an invoice,
 * so when every source fails (and nothing is cached) this throws and the order
 * stays retryable instead of being invoiced at a made-up rate.
 */

import { SATS_PER_BTC } from './pricing.js';

const CACHE_DURATION_MS = 5 * 60 * 1000;
const SOURCE_TIMEOUT_MS = 5000;

const NO_RATES = { gbp: null, usd: null, eur: null };

let cached = null;

function safeAverage(values) {
  const valid = values.filter((v) => typeof v === 'number' && Number.isFinite(v) && v > 0);
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

async function getJson(fetchImpl, url) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
  return response.ok ? response.json() : null;
}

async function fetchCoinGecko(fetchImpl) {
  try {
    const data = await getJson(
      fetchImpl,
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp,usd,eur'
    );
    return {
      gbp: data?.bitcoin?.gbp || null,
      usd: data?.bitcoin?.usd || null,
      eur: data?.bitcoin?.eur || null,
    };
  } catch {
    return NO_RATES;
  }
}

async function fetchKraken(fetchImpl) {
  try {
    const [gbp, usd, eur] = await Promise.all(
      ['XBTGBP', 'XBTUSD', 'XBTEUR'].map((pair) =>
        getJson(fetchImpl, `https://api.kraken.com/0/public/Ticker?pair=${pair}`)
      )
    );
    const last = (data, key) => {
      const c = data?.result?.[key]?.c?.[0];
      return c ? parseFloat(c) : null;
    };
    return { gbp: last(gbp, 'XXBTZGBP'), usd: last(usd, 'XXBTZUSD'), eur: last(eur, 'XXBTZEUR') };
  } catch {
    return NO_RATES;
  }
}

async function fetchCoinbase(fetchImpl) {
  try {
    const [gbp, usd, eur] = await Promise.all(
      ['GBP', 'USD', 'EUR'].map(async (currency) => {
        const data = await getJson(
          fetchImpl,
          `https://api.coinbase.com/v2/prices/BTC-${currency}/spot`
        );
        return data?.data?.amount ? parseFloat(data.data.amount) : null;
      })
    );
    return { gbp, usd, eur };
  } catch {
    return NO_RATES;
  }
}

/**
 * Averaged BTC prices -> sats-per-unit, derived exactly as
 * hooks/use-exchange-rate.ts does (Math.round(1e8 / btcPrice)).
 * @param {{ fetch?: typeof fetch, now?: () => number }} [deps]
 * @returns {Promise<{ satsPerGbp: number, satsPerUsd: number, satsPerEur: number }>}
 */
export async function getSatsRates({ fetch: fetchImpl = fetch, now = Date.now } = {}) {
  if (cached && now() - cached.updatedAt < CACHE_DURATION_MS) return cached.rates;

  const [coingecko, kraken, coinbase] = await Promise.all([
    fetchCoinGecko(fetchImpl),
    fetchKraken(fetchImpl),
    fetchCoinbase(fetchImpl),
  ]);
  const gbp = safeAverage([coingecko.gbp, kraken.gbp, coinbase.gbp]);
  const usd = safeAverage([coingecko.usd, kraken.usd, coinbase.usd]);
  const eur = safeAverage([coingecko.eur, kraken.eur, coinbase.eur]);

  if (!gbp && !usd) {
    if (cached) return cached.rates; // a stale real rate beats none
    throw new Error('All exchange rate sources failed');
  }

  // Same cross-rate derivation as the website when one currency is missing.
  const btcToGbp = gbp || usd * 0.79;
  const btcToUsd = usd || gbp / 0.79;
  const btcToEur = eur || (usd ? usd * 0.92 : (gbp / 0.79) * 0.92);

  const rates = {
    satsPerGbp: Math.round(SATS_PER_BTC / btcToGbp),
    satsPerUsd: Math.round(SATS_PER_BTC / btcToUsd),
    satsPerEur: Math.round(SATS_PER_BTC / btcToEur),
  };
  cached = { rates, updatedAt: now() };
  return rates;
}

/** Test hook: forget the cached rates. */
export function resetRateCache() {
  cached = null;
}
