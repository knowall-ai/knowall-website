// <!-- @include cta {...} -->
// The closing contact slide every deck ends on: a headline over the deck's
// hero art (--deck-hero), a pitch with one button, and the contact details.
//
//   label        the slide's aria-label, e.g. "Slide 6 of 6: Ready to discover"
//   heading      the headline (HTML; use <br /> to break it)
//   pitch        one paragraph (HTML; <strong> picks out the offer)
//   button       { text, icon, ariaLabel, href? }: href defaults to the email link
//   mailSubject  optional subject line for the email links
//   site         optional { href, text } for the web link (default knowall.ai)
//   className    optional class on the <section>, e.g. "cta--mid-subject"
export default function cta({
  label,
  heading,
  pitch,
  button,
  mailSubject,
  site = { href: 'https://www.knowall.ai', text: 'knowall.ai' },
  className,
}) {
  const mailto = `mailto:hello@knowall.ai${mailSubject ? `?subject=${encodeURIComponent(mailSubject)}` : ''}`;
  return `        <section${className ? ` class="${className}"` : ''} role="region" aria-label="${label}">
          <div class="cta-top">
            <h2>${heading}</h2>
            <img class="logo-dark" src="/images/logo.png" alt="KnowAll.ai" />
          </div>
          <div class="cta-bottom">
            <div class="cta-copy">
              <p class="cta-text">
                ${pitch}
              </p>
              <a class="cta-button" href="${button.href ?? mailto}" aria-label="${button.ariaLabel}">
                <svg class="ic" aria-hidden="true"><use href="icons.svg#i-${button.icon}" /></svg>
                ${button.text}
              </a>
            </div>
            <div class="contact-row">
              <div class="contact-item">
                <svg class="ic" aria-hidden="true"><use href="icons.svg#i-mail" /></svg>
                <a href="${mailto}">hello@knowall.ai</a>
              </div>
              <div class="contact-item">
                <svg class="ic" aria-hidden="true"><use href="icons.svg#i-globe" /></svg>
                <a href="${site.href}">${site.text}</a>
              </div>
            </div>
          </div>
        </section>
`;
}
