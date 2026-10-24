// <!-- @include products {"label": "..."} -->
// Our products, from one list so names, copy and links stay in step: all five
// as icon cards, with their websites.
import { bandSlide } from './band-slide.mjs';

const PRODUCTS = {
  zaplie: {
    name: 'Zaplie',
    icon: 'zap',
    site: 'getzapl.ie',
    brief:
      'Bitcoin microtransactions and AI agents inside Microsoft Teams, rewarding contributions in proportion to the value they deliver.',
  },
  zapdesk: {
    name: 'Zapdesk',
    icon: 'clipboard-list',
    site: 'zapdesk.knowall.ai',
    brief:
      'Azure DevOps powered support ticketing &mdash; tickets living alongside your engineering work items, with Lightning tipping.',
  },
  thyme: {
    name: 'Thyme',
    icon: 'timer',
    site: 'getthyme.ai',
    brief:
      'Time tracking for Business Central, keeping Jobs and Job Journal Lines in sync automatically.',
  },
  wardie: {
    name: 'Wardie',
    icon: 'shield-check',
    site: 'getward.ie',
    brief:
      'A free, open-source guardian app that checks every laptop and phone against Cyber Essentials and explains fixes in plain English.',
  },
  bookie: {
    name: 'Bookie',
    icon: 'piggy-bank',
    site: 'getbook.ie',
    brief:
      'A free, open-source, Xero-style accounting portal over Xero or Business Central, with Bookie the AI bookkeeper built in.',
  },
};

function body() {
  const list = ['zaplie', 'zapdesk', 'thyme', 'wardie', 'bookie'].map((k) => PRODUCTS[k]);
  return `            <div class="cards-5">
${list
  .map(
    (p) => `              <div class="card stack">
                <div class="chip" aria-hidden="true">
                  <svg class="ic"><use href="icons.svg#i-${p.icon}" /></svg>
                </div>
                <div>
                  <h4>${p.name}</h4>
                  <p>${p.brief}</p>
                </div>
              </div>
`
  )
  .join('')}            </div>
            <div class="pill-row" role="list" aria-label="Product websites">
${list.map((p) => `              <span class="pill" role="listitem">${p.site}</span>\n`).join('')}            </div>
`;
}

export default function products({ label }) {
  return bandSlide({
    label,
    scene: 'images/scene-gallery.jpg',
    title: 'Our products',
    sub: 'Built by us, running in production today',
    body: body(),
  });
}
