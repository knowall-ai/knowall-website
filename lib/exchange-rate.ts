/**
 * Bitcoin exchange rates for the checkout, ported from robotechy.com's
 * lib/exchangeRate. Averages BTC prices from CoinGecko, Kraken and Coinbase
 * (any subset that responds) and caches the result for 5 minutes; the
 * checkout uses it to convert the GBP order total into the sats `amount` the
 * Gamma order carries.
 */

export interface ExchangeRates {
  btcToGbp: number;
  btcToUsd: number;
  btcToEur: number;
  updatedAt: number;
  sources: string[];
}

const CACHE_DURATION_MS = 5 * 60 * 1000;
export const SATS_PER_BTC = 100_000_000;

// Fallback prices when every source fails (approximate; only used so a rate
// outage degrades to a stale-but-sane conversion instead of a broken checkout).
export const FALLBACK_BTC_GBP = 80_000;
export const FALLBACK_BTC_USD = 100_000;
export const FALLBACK_BTC_EUR = 92_000;

let cachedRates: ExchangeRates | null = null;

interface SourceRates {
  gbp: number | null;
  usd: number | null;
  eur: number | null;
}

const NO_RATES: SourceRates = { gbp: null, usd: null, eur: null };

/** Average the valid (positive, finite) values, or null when there are none. */
function safeAverage(values: (number | null | undefined)[]): number | null {
  const valid = values.filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
  );
  if (valid.length === 0) return null;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}

async function fetchCoinGecko(): Promise<SourceRates> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=gbp,usd,eur',
      { signal: AbortSignal.timeout(5000) }
    );
    if (!response.ok) return NO_RATES;
    const data = await response.json();
    return {
      gbp: data.bitcoin?.gbp || null,
      usd: data.bitcoin?.usd || null,
      eur: data.bitcoin?.eur || null,
    };
  } catch {
    return NO_RATES;
  }
}

async function fetchKraken(): Promise<SourceRates> {
  try {
    const pairs = ['XBTGBP', 'XBTUSD', 'XBTEUR'];
    const [gbpData, usdData, eurData] = await Promise.all(
      pairs.map(async (pair) => {
        const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${pair}`, {
          signal: AbortSignal.timeout(5000),
        });
        return response.ok ? response.json() : null;
      })
    );
    const last = (data: unknown, key: string): number | null => {
      const c = (data as { result?: Record<string, { c?: string[] }> } | null)?.result?.[key]
        ?.c?.[0];
      return c ? parseFloat(c) : null;
    };
    return {
      gbp: last(gbpData, 'XXBTZGBP'),
      usd: last(usdData, 'XXBTZUSD'),
      eur: last(eurData, 'XXBTZEUR'),
    };
  } catch {
    return NO_RATES;
  }
}

async function fetchCoinbase(): Promise<SourceRates> {
  try {
    const currencies = ['GBP', 'USD', 'EUR'];
    const [gbp, usd, eur] = await Promise.all(
      currencies.map(async (currency) => {
        const response = await fetch(`https://api.coinbase.com/v2/prices/BTC-${currency}/spot`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data?.data?.amount ? parseFloat(data.data.amount) : null;
      })
    );
    return { gbp, usd, eur };
  } catch {
    return NO_RATES;
  }
}

/** Fetch and average rates from the exchanges (throws when all fail). */
async function fetchRates(): Promise<ExchangeRates> {
  const [coingecko, kraken, coinbase] = await Promise.all([
    fetchCoinGecko(),
    fetchKraken(),
    fetchCoinbase(),
  ]);

  const sources: string[] = [];
  if (coingecko.gbp || coingecko.usd) sources.push('CoinGecko');
  if (kraken.gbp || kraken.usd) sources.push('Kraken');
  if (coinbase.gbp || coinbase.usd) sources.push('Coinbase');

  const avgGbp = safeAverage([coingecko.gbp, kraken.gbp, coinbase.gbp]);
  const avgUsd = safeAverage([coingecko.usd, kraken.usd, coinbase.usd]);
  const avgEur = safeAverage([coingecko.eur, kraken.eur, coinbase.eur]);

  if (!avgGbp && !avgUsd) {
    throw new Error('All exchange rate sources failed');
  }

  return {
    btcToGbp: avgGbp || (avgUsd ? avgUsd * 0.79 : FALLBACK_BTC_GBP),
    btcToUsd: avgUsd || (avgGbp ? avgGbp / 0.79 : FALLBACK_BTC_USD),
    btcToEur: avgEur || (avgUsd ? avgUsd * 0.92 : FALLBACK_BTC_EUR),
    updatedAt: Date.now(),
    sources,
  };
}

/** Cached-or-fresh exchange rates; a stale cache beats a hard failure. */
export async function getExchangeRates(): Promise<ExchangeRates> {
  if (cachedRates && Date.now() - cachedRates.updatedAt < CACHE_DURATION_MS) {
    return cachedRates;
  }
  try {
    cachedRates = await fetchRates();
    return cachedRates;
  } catch (error) {
    if (cachedRates) return cachedRates;
    throw error;
  }
}
