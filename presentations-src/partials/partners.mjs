// <!-- @include partners {"label": "..."} -->
// Platforms & partners: "We build on" beside "We go to market with".
import { bandSlide } from './band-slide.mjs';

const microsoftMark = `<svg viewBox="0 0 96 96" width="44" height="44" role="img" aria-label="Microsoft">
                      <path fill="#F25022" d="M0 0h45.5v45.5H0z" />
                      <path fill="#7FBA00" d="M50.5 0H96v45.5H50.5z" />
                      <path fill="#00A4EF" d="M0 50.5h45.5V96H0z" />
                      <path fill="#FFB900" d="M50.5 50.5H96V96H50.5z" />
                    </svg>
                    <span class="plate-word">Microsoft</span>`;

const PLATFORMS = [
  {
    plate: microsoftMark,
    text: 'Azure, Microsoft 365 and Power Platform &mdash; the cloud we build on.',
  },
  {
    plate: '<img src="images/logos/anthropic-dark.svg" alt="Anthropic" />',
    text: 'Claude &mdash; the frontier models behind our agents.',
  },
  {
    plate: '<span class="plate-word">OpenAI</span>',
    text: 'GPT &mdash; the models behind our voice agents.',
  },
];

const GO_TO_MARKET = [
  {
    link: { href: 'https://www.eirbusiness.co.uk', label: 'eir Business UK' },
    plateClass: 'logo-plate--eir',
    plate: '<img class="eir-logo" src="images/logos/eir-business.svg" alt="eir business" />',
    text: 'Enterprise connectivity and infrastructure across Ireland.',
  },
  {
    plate: '<img src="images/logos/xma.png" alt="XMA" />',
    text: 'Technology services and enterprise IT across the UK.',
  },
];

function card(partner, pad) {
  let logo = `<div class="logo-plate${partner.plateClass ? ` ${partner.plateClass}` : ''}">${partner.plate}</div>`;
  if (partner.link) {
    logo = `<a class="partner-link" href="${partner.link.href}" target="_blank" rel="noopener noreferrer" aria-label="${partner.link.label}">
${pad}    ${logo}
${pad}  </a>`;
  }
  return `${pad}<div class="card">
${pad}  ${logo}
${pad}  <p>${partner.text}</p>
${pad}</div>
`;
}

export default function partners({ label }) {
  const pad = '                  ';
  return bandSlide({
    label,
    scene: 'images/scene-boardroom.jpg',
    title: 'Platforms &amp; partners',
    sub: 'The technology we build on &mdash; and who takes it to market with us',
    body: `            <div class="partner-groups">
              <div>
                <p class="partner-label">We build on</p>
                <div class="partner-grid partner-grid--3">
${PLATFORMS.map((p) => card(p, pad)).join('')}                </div>
              </div>
              <div>
                <p class="partner-label">We go to market with</p>
                <div class="partner-grid partner-grid--2">
${GO_TO_MARKET.map((p) => card(p, pad)).join('')}                </div>
              </div>
            </div>
`,
  });
}
