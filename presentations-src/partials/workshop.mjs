// <!-- @include workshop {...} -->
// One workshop per slide (T-Minus-15 workshops deck): the workshop's art in a
// panel on the left, fading into the charcoal, and its details on the right.
//
//   label        the slide's aria-label, e.g. "Slide 4 of 16: W-M0, Assemble: The Avengers of Agile"
//   image        art path, e.g. "images/tminus15-workshops/m0-assemble.jpg"
//   alt          description of the art (the panel is role="img")
//   focus        optional horizontal focus of the art in the panel (CSS %), default 50%
//   kicker       e.g. "Methodology &middot; W-M1"
//   phase        optional lifecycle stage shown as a green capitals prefix on the
//                title, e.g. "Prep" renders "PREP: <title>"
//   title        the workshop title (HTML)
//   subtitle     optional line under the title (HTML)
//   chapter      optional book chapter(s) the workshop is built on (HTML)
//   chapterLabel optional lead-in for the chapter line, default "From the book"
//   duration     optional length, e.g. "Half-day workshop" (shown with a clock)
//   audience     who should attend (HTML)
//   description  what the workshop covers and why (HTML)
//   topics       array of topic strings (HTML)
//   columns      optional topic columns, default 2
//   outcomes     optional: what attendees leave with (HTML)
//   breakout     optional 2-hour break-out lab: { title, detail } (HTML)
//   followup     optional follow-up sessions (HTML), shown beside "You leave with"
//   note         optional footnote, e.g. "Can run as a series of sessions"
//   compact      optional: tighter, smaller topic list for long lists
export default function workshop({
  label,
  image,
  alt,
  focus = '50%',
  kicker,
  phase,
  title,
  subtitle,
  chapter,
  chapterLabel = 'From the book',
  duration,
  audience,
  description,
  topics = [],
  columns = 2,
  outcomes,
  breakout,
  followup,
  note,
  compact = false,
}) {
  const topicItems = topics.map((t) => `                <li>${t}</li>`).join('\n');
  // What attendees take away, and the optional hands-on lab that follows,
  // side by side under the topics.
  const takeaways = [
    outcomes
      ? `              <div class="ws-block">
                <h3 class="ws-label"><svg class="ic" aria-hidden="true"><use href="icons.svg#i-graduation-cap" /></svg>You leave with</h3>
                <p>${outcomes}</p>
              </div>`
      : '',
    breakout
      ? `              <div class="ws-block">
                <h3 class="ws-label"><svg class="ic" aria-hidden="true"><use href="icons.svg#i-flask-conical" /></svg>Optional break-out &middot; 2 hours</h3>
                <p><strong>${breakout.title}:</strong> ${breakout.detail}</p>
              </div>`
      : '',
    followup
      ? `              <div class="ws-block">
                <h3 class="ws-label"><svg class="ic" aria-hidden="true"><use href="icons.svg#i-calendar-check" /></svg>Optional follow-ups</h3>
                <p>${followup}</p>
              </div>`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  return `        <section class="ws${compact ? ' ws--compact' : ''}" role="region" aria-label="${label}">
          <div class="ws-art" style="--ws-art: url('${image}'); --ws-focus: ${focus}" role="img" aria-label="${alt}"></div>
          <img class="logo-light" src="/images/logo.png" alt="KnowAll.ai" />
          <div class="ws-copy" data-fit>
            <div class="ws-head">
              <p class="kicker">${kicker}</p>
              <h2>${phase ? `<span class="ws-phase">${phase}:</span> ` : ''}${title}</h2>${subtitle ? `\n              <p class="ws-sub">${subtitle}</p>` : ''}${
                chapter
                  ? `\n              <p class="ws-chapter"><svg class="ic" aria-hidden="true"><use href="icons.svg#i-scroll-text" /></svg><span>${chapterLabel}: ${chapter}</span></p>`
                  : ''
              }${
                duration
                  ? `\n              <p class="ws-chapter ws-duration"><svg class="ic" aria-hidden="true"><use href="icons.svg#i-clock" /></svg><span>${duration}</span></p>`
                  : ''
              }
            </div>
            <div class="ws-block">
              <h3 class="ws-label"><svg class="ic" aria-hidden="true"><use href="icons.svg#i-users" /></svg>Audience</h3>
              <p>${audience}</p>
            </div>
            <div class="ws-block">
              <h3 class="ws-label"><svg class="ic" aria-hidden="true"><use href="icons.svg#i-file-text" /></svg>Description</h3>
              <p>${description}</p>
            </div>
            <div class="ws-block">
              <h3 class="ws-label"><svg class="ic" aria-hidden="true"><use href="icons.svg#i-clipboard-list" /></svg>Topics</h3>
              <ul class="ws-topics" style="--ws-cols: ${columns}">
${topicItems}
              </ul>
            </div>${takeaways ? `\n            <div class="ws-pair">\n${takeaways}\n            </div>` : ''}${note ? `\n            <p class="ws-note"><svg class="ic" aria-hidden="true"><use href="icons.svg#i-calendar-check" /></svg>${note}</p>` : ''}
          </div>
        </section>
`;
}
