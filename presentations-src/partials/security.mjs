// <!-- @include security {"label": "..."} -->
// Enterprise-grade security: four points, short copy in larger type.
import { bandSlide } from './band-slide.mjs';

const POINTS = [
  {
    icon: 'shield-check',
    title: 'Data protection',
    text: 'Encrypted in transit and at rest, managed keys, and data residency you choose.',
  },
  {
    icon: 'key-round',
    title: 'Access control',
    text: 'Microsoft Entra ID, role-based access and MFA on every agent interaction.',
  },
  {
    icon: 'scroll-text',
    title: 'Audit &amp; compliance',
    text: 'A complete audit trail of what every agent did, plugged into your governance.',
  },
  {
    icon: 'network',
    title: 'Zero trust',
    text: 'Network isolation and secure endpoints, with rate limiting and threat detection.',
  },
];

export default function security({ label }) {
  const cards = POINTS.map(
    (point) => `              <div class="card">
                <div class="chip" aria-hidden="true"><svg class="ic"><use href="icons.svg#i-${point.icon}" /></svg></div>
                <div>
                  <h4>${point.title}</h4>
                  <p>${point.text}</p>
                </div>
              </div>
`
  ).join('');
  return bandSlide({
    label,
    scene: 'images/scene-vault.jpg',
    title: 'Enterprise-grade security',
    sub: 'Built on Microsoft Azure &mdash; governed like any system you run',
    contentClass: 'gap-56',
    body: `            <div class="cards-2 security">
${cards}            </div>
`,
  });
}
