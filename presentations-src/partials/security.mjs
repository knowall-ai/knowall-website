// <!-- @include security {"label": "...", "variant": "brief" | "full"} -->
// Enterprise-grade security: the same four points in every deck.
//   brief  short copy in larger type (Company Overview)
//   full   the longer explanation (Agentic AI Solutions)
import { bandSlide, pick } from './band-slide.mjs';

const POINTS = [
  {
    icon: 'shield-check',
    title: 'Data protection',
    brief: 'Encrypted in transit and at rest, managed keys, and data residency you choose.',
    full: 'End-to-end encryption, secure key management and data-residency controls aligned with your compliance requirements.',
  },
  {
    icon: 'key-round',
    title: 'Access control',
    brief: 'Microsoft Entra ID, role-based access and MFA on every agent interaction.',
    full: 'Role-based access control, Microsoft Entra ID integration and multi-factor authentication for every agent interaction.',
  },
  {
    icon: 'scroll-text',
    title: 'Audit &amp; compliance',
    brief: 'A complete audit trail of what every agent did, plugged into your governance.',
    full: 'Complete audit trails, compliance reporting and integration with your existing governance frameworks.',
  },
  {
    icon: 'network',
    title: { brief: 'Zero trust', full: 'Secure architecture' },
    brief: 'Network isolation and secure endpoints, with rate limiting and threat detection.',
    full: 'Zero-trust architecture, network isolation and secure API endpoints with rate limiting and threat detection.',
  },
];

const VARIANTS = {
  brief: {
    sub: 'Built on Microsoft Azure &mdash; governed like any system you run',
    contentClass: 'gap-56',
    gridClass: 'cards-2 security',
  },
  full: {
    sub: 'Built on Microsoft Azure with enterprise compliance',
    contentClass: '',
    gridClass: 'cards-2',
  },
};

export default function security({ label, variant }) {
  const v = pick(VARIANTS, variant, 'security');
  const cards = POINTS.map(
    (point) => `              <div class="card">
                <div class="chip" aria-hidden="true"><svg class="ic"><use href="icons.svg#i-${point.icon}" /></svg></div>
                <div>
                  <h4>${typeof point.title === 'string' ? point.title : point.title[variant]}</h4>
                  <p>${point[variant]}</p>
                </div>
              </div>
`
  ).join('');
  return bandSlide({
    label,
    scene: 'images/scene-vault.jpg',
    title: 'Enterprise-grade security',
    sub: v.sub,
    contentClass: v.contentClass,
    body: `            <div class="${v.gridClass}">
${cards}            </div>
`,
  });
}
