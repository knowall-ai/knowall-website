import type { YearCount } from './cve-trend-chart';

// Snapshot figures for the /purple-team page, taken on 24 Oct 2026. Refresh them
// by re-running the queries below; the live, per-client numbers belong in the
// Purple Team Portal (security.knowall.ai), not on the marketing site.

/**
 * CVEs published per year, from the NVD CVE API 2.0 (`pubStartDate`/`pubEndDate`,
 * summed over calendar quarters as the API caps ranges at 120 days, `totalResults`). 2026 is year to date.
 */
export const CVES_PER_YEAR: YearCount[] = [
  { year: 2017, count: 18113 },
  { year: 2018, count: 18154 },
  { year: 2019, count: 18938 },
  { year: 2020, count: 19222 },
  { year: 2021, count: 21950 },
  { year: 2022, count: 26431 },
  { year: 2023, count: 30949 },
  { year: 2024, count: 40704 },
  { year: 2025, count: 49972 },
  { year: 2026, count: 88565, partial: true },
];

/** The partial year's count runs from 1 Jan to this date (inclusive). */
export const CVES_AS_OF = '2026-10-23';

/** NVD CVEs published 24 Sep – 24 Oct 2026. */
export const CVES_LAST_30_DAYS = 16966;

/** The year KEV_ADDED_LAST_YEAR counts: update both together. */
export const KEV_YEAR = 2025;

/** CISA Known Exploited Vulnerabilities catalogue entries with a 2025 `dateAdded`. */
export const KEV_ADDED_LAST_YEAR = 245;

/** Where the figures come from, linked under each chart and number on the page. */
export const SOURCES = {
  nvd: {
    label: 'NIST National Vulnerability Database',
    url: 'https://nvd.nist.gov/vuln/search',
  },
  nvdApi: {
    label: 'NVD CVE API 2.0',
    url: 'https://nvd.nist.gov/developers/vulnerabilities',
  },
  kev: {
    label: "CISA's Known Exploited Vulnerabilities catalogue",
    url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
  },
} as const;
