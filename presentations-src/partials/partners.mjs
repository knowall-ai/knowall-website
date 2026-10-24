// <!-- @include partners {"label": "...", "variant": "grouped" | "flat"} -->
// Platforms & partners: who we build on, and who we go to market with.
//   grouped  "We build on" beside "We go to market with" (Company Overview)
//   flat     all five in one row, with the sectors line (Agentic AI Solutions)
import { bandSlide, pick } from './band-slide.mjs';

const microsoftMark = (
  size
) => `<svg viewBox="0 0 96 96" width="${size}" height="${size}" role="img" aria-label="Microsoft">
                      <path fill="#F25022" d="M0 0h45.5v45.5H0z" />
                      <path fill="#7FBA00" d="M50.5 0H96v45.5H50.5z" />
                      <path fill="#00A4EF" d="M0 50.5h45.5V96H0z" />
                      <path fill="#FFB900" d="M50.5 50.5H96V96H50.5z" />
                    </svg>
                    <span class="plate-word">Microsoft</span>`;

const PLATFORMS = [
  {
    plate: { grouped: microsoftMark(44), flat: microsoftMark(40) },
    grouped: 'Azure, Microsoft 365 and Power Platform &mdash; the cloud we build on.',
    flat: 'Azure, Microsoft 365 and Power Platform &mdash; the cloud we build on.',
  },
  {
    plate: '<img src="images/logos/anthropic-dark.svg" alt="Anthropic" />',
    grouped: 'Claude &mdash; the frontier models behind our agents.',
    flat: 'Claude &mdash; the frontier AI models that power our agents.',
  },
  {
    plate: '<span class="plate-word">OpenAI</span>',
    grouped: 'GPT &mdash; the models behind our voice agents.',
    flat: 'GPT &mdash; frontier models behind our voice agents and copilots.',
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

function card(partner, text, variant, pad) {
  const plate = typeof partner.plate === 'string' ? partner.plate : partner.plate[variant];
  let logo = `<div class="logo-plate${partner.plateClass ? ` ${partner.plateClass}` : ''}">${plate}</div>`;
  if (partner.link) {
    logo = `<a class="partner-link" href="${partner.link.href}" target="_blank" rel="noopener noreferrer" aria-label="${partner.link.label}">
${pad}    ${logo}
${pad}  </a>`;
  }
  return `${pad}<div class="card">
${pad}  ${logo}
${pad}  <p>${text}</p>
${pad}</div>
`;
}

const VARIANTS = {
  grouped: {
    sub: 'The technology we build on &mdash; and who takes it to market with us',
    body: () => {
      const pad = '                  ';
      return `            <div class="partner-groups">
              <div>
                <p class="partner-label">We build on</p>
                <div class="partner-grid partner-grid--3">
${PLATFORMS.map((p) => card(p, p.grouped, 'grouped', pad)).join('')}                </div>
              </div>
              <div>
                <p class="partner-label">We go to market with</p>
                <div class="partner-grid partner-grid--2">
${GO_TO_MARKET.map((p) => card(p, p.text, 'grouped', pad)).join('')}                </div>
              </div>
            </div>
`;
    },
  },
  flat: {
    sub: 'The technology we build on &mdash; and who we bring it to market with',
    body: () => {
      const pad = '              ';
      return `            <div class="partner-grid">
${PLATFORMS.map((p) => card(p, p.flat, 'flat', pad)).join('')}${GO_TO_MARKET.map((p) => card(p, p.text, 'flat', pad)).join('')}            </div>
            <div class="pill-row partner-sectors">
              <span class="pill">
                <svg class="ic" aria-hidden="true"><use href="icons.svg#i-handshake" /></svg>
                Bringing agentic AI to enterprise customers across telecoms, manufacturing,
                education and healthcare
              </span>
            </div>
`;
    },
  },
};

export default function partners({ label, variant }) {
  const v = pick(VARIANTS, variant, 'partners');
  return bandSlide({
    label,
    scene: 'images/scene-boardroom.jpg',
    title: 'Platforms &amp; partners',
    sub: v.sub,
    body: v.body(),
  });
}
