/**
 * Configuration — environment variables only, ported from robotechy.com's
 * order-service. A local `.env` file (gitignored) is read as a convenience for
 * development; in deployment the variables are supplied by the host
 * (App Service settings, container env, systemd EnvironmentFile, ...).
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * The KnowAll AI company pubkey (hex). The order service runs AS the company
 * identity (Ben's decision — no dedicated shop key), so startup refuses any
 * ORDER_SERVICE_KEY that does not derive to exactly this pubkey: a typo'd or
 * wrong key would otherwise silently listen on the wrong npub and every order
 * would go unanswered.
 * npub1kue7etfxtkxlv0s4u2xjf9epgxj7hssmlhc4x2k66tn8q8598zfqj322ar
 */
export const KNOWALL_PUBKEY = 'b733ecad265d8df63e15e28d24972141a5ebc21bfdf1532adad2e6701e853892';

/**
 * Load environment variables from a local .env file (simple parser, no
 * external dependencies). Values already present in the environment win.
 */
function loadEnvFile() {
  const envPath = resolve(__dirname, '..', '.env');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        const unquoted = value.replace(/^["']|["']$/g, '');
        if (!(key.trim() in process.env)) {
          process.env[key.trim()] = unquoted;
        }
      }
    }
    console.log('[Config] Loaded .env file');
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn('[Config] Error reading .env file:', error.message);
    }
  }
}

// Load .env file on import
loadEnvFile();

/** Get required environment variable (throws if not set). */
function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Get optional environment variable with default. */
function getEnv(name, defaultValue = '') {
  return process.env[name] || defaultValue;
}

// Configuration object
export const config = {
  // The company identity's secret key: nsec or 64-char hex. NEVER committed —
  // supplied via the environment at deployment. Must derive to KNOWALL_PUBKEY
  // (validated at startup).
  orderServiceKey: requireEnv('ORDER_SERVICE_KEY'),

  // Lightning Address invoices are generated from (LNURL-pay).
  lightningAddress: requireEnv('LIGHTNING_ADDRESS'),

  // Relays (comma-separated). Defaults to the site's shop relay set.
  relays: getEnv('RELAYS', 'wss://relay.damus.io,wss://nos.lol,wss://relay.primal.net')
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean),
};

export default config;
