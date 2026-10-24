// <!-- @include products {"label": "...", "variant": "icons" | "shots"} -->
// Our products, from one list so names, copy and links stay in step.
//   icons  all five as icon cards, with their websites (Company Overview)
//   shots  three with real screenshots and links (Agentic AI Solutions)
import { bandSlide, pick } from './band-slide.mjs';

const PRODUCTS = {
  zaplie: {
    name: 'Zaplie',
    icon: 'zap',
    site: 'getzapl.ie',
    brief:
      'Bitcoin microtransactions and AI agents inside Microsoft Teams, rewarding contributions in proportion to the value they deliver.',
    full: 'An open-source platform that integrates Microsoft Teams with Bitcoin microtransactions and AI agents &mdash; rewarding contributions, whether human or AI, in proportion to the value they deliver.',
    shot: { src: '/images/products/zaplie-feed.png', alt: 'The Zaplie activity feed' },
    link: {
      href: 'https://getzapl.ie',
      text: 'getzapl.ie',
    },
  },
  zapdesk: {
    name: 'Zapdesk',
    icon: 'clipboard-list',
    site: 'zapdesk.knowall.ai',
    brief:
      'Azure DevOps powered support ticketing &mdash; tickets living alongside your engineering work items, with Lightning tipping.',
    full: 'Azure DevOps powered support ticketing &mdash; a Zendesk-style portal that uses Azure DevOps as its backend, so support tickets live alongside your engineering work items. Familiar helpdesk interface, with Bitcoin Lightning tipping so customers can reward agents directly.',
    shot: { src: '/images/products/zapdesk.png', alt: 'The Zapdesk support portal' },
    link: { href: 'https://zapdesk.knowall.ai', text: 'zapdesk.knowall.ai' },
  },
  thyme: {
    name: 'Thyme',
    icon: 'timer',
    site: 'getthyme.ai',
    brief:
      'Time tracking for Business Central, keeping Jobs and Job Journal Lines in sync automatically.',
    full: 'Time tracking for Business Central. Track your week in an intuitive timesheet grid and let Thyme keep your Business Central Jobs and Job Journal Lines in sync automatically &mdash; with single sign-on via Microsoft Entra ID.',
    shot: { src: '/images/products/thyme-homepage.png', alt: 'The Thyme timesheet grid' },
    link: { href: 'https://getthyme.ai', text: 'getthyme.ai' },
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

const VARIANTS = {
  icons: {
    scene: 'images/scene-gallery.jpg',
    body: () => {
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
    },
  },
  shots: {
    scene: 'images/scene-cyber-sky.jpg',
    body: () => {
      const list = ['zapdesk', 'thyme', 'zaplie'].map((k) => PRODUCTS[k]);
      return `            <p class="lead">
              We do not only build for clients. These are our own products &mdash; the same
              Microsoft and Bitcoin foundations we bring to your projects.
            </p>
            <div class="cards-3 cards--linked">
${list
  .map(
    (p) => `              <div class="card stack">
                <div>
                  <img class="product-shot" src="${p.shot.src}" alt="${p.shot.alt}" />
                  <h4>${p.name}</h4>
                  <p>${p.full}</p>
                  <a class="card-link" href="${p.link.href}" target="_blank" rel="noopener noreferrer">${p.link.text}</a>
                </div>
              </div>
`
  )
  .join('')}            </div>
`;
    },
  },
};

export default function products({ label, variant }) {
  const v = pick(VARIANTS, variant, 'products');
  return bandSlide({
    label,
    scene: v.scene,
    title: 'Our products',
    sub: 'Built by us, running in production today',
    body: v.body(),
  });
}
