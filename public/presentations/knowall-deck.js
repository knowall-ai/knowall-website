// Shared runtime for the KnowAll AI presentation decks. Loaded by every deck
// after reveal.js. Behaviour only — the matching styles (floating CTA pill,
// image drift) live in knowall-deck.css alongside the rest of the house style.

// --- Per-slide call to action -------------------------------------------
// Every content slide carries a floating "Book a working session" pill; the
// cover, the slide after it and the closing CTA slide stay clean.
const deckSlides = Array.from(document.querySelectorAll('.reveal .slides > section'));
deckSlides.slice(2, -1).forEach((slide) => {
  slide.insertAdjacentHTML(
    'beforeend',
    '<a class="slide-cta" href="https://www.knowall.ai/#contact" aria-label="Book a working session with KnowAll AI">Book a working session</a>'
  );
});

// --- Sequenced reveal -------------------------------------------------
// Cards, KPIs and bullet groups arrive one at a time so the presenter can
// talk to each. Titles, kickers and leads are never fragmented, and the
// cover and closing slides always arrive whole.
(function addDeckFragments() {
  const groups = [
    [
      '.cards-2 > .card, .cards-2 > div > .card, .cards-3 > .card, .cards-5 > .card, .partner-grid > .card',
      'fade-up',
    ],
    ['.cards-5 > .stage', 'fade-up'],
    ['.checks > .check', 'fade-up'],
    ['.agent-row > .agent', 'fade-up'],
    ['.timeline > .timeline-point', 'fade-up'],
    ['.kpi-row > .kpi', 'fade-in'],
    ['.pill-row > .pill', 'fade-in'],
    ['.loop-stage', 'fade-in'],
  ];
  deckSlides.forEach((section, index) => {
    let seqIndex = 0;
    if (index === 0 || index === deckSlides.length - 1) return;
    groups.forEach(([selector, effect]) => {
      section.querySelectorAll(selector).forEach((el) => {
        if (el.classList.contains('seq')) return;
        // Auto-reveal, not click-to-reveal. Reveal fragments need a
        // keypress each: content looked MISSING until clicked (the
        // "challenge slide is empty" bug), Back consumed a hidden
        // fragment step instead of changing slide (the "went back
        // two slides" bug), and presenting meant remembering to
        // click ~27 times (Ben, 2026-07-28, asked four times).
        // A staggered CSS animation on slide entry gives the same
        // one-at-a-time arrival with nothing to press.
        el.classList.add('seq', effect);
        el.style.setProperty('--seq-i', seqIndex++);
      });
    });
  });
})();

// --- A floating control never covers slide content --------------------
// Every slide reserves a strip at its foot for the CTA pill, but a few
// slides carry enough content to reach into it. Rather than let the pill
// sit on a KPI, measure on each slide change and drop the pill on the
// slides that need the room. Measured, not hard-coded, so it stays true
// if the copy changes.
const CONTENT_SELECTOR =
  '.card, .check, .kpi, .pill, .stage, .agent, .timeline-point, .loop-stage,' +
  ' h1, h2, h3, h4, p, img, svg, .quote, .quote-mark';
function guardFloatingControls(slide) {
  if (!slide) return;
  const controls = slide.querySelectorAll('.slide-cta');
  if (!controls.length) return;
  controls.forEach((control) => control.classList.remove('is-clashing'));
  const content = Array.from(slide.querySelectorAll(CONTENT_SELECTOR)).filter(
    (el) => !el.closest('.slide-cta') && el.getClientRects().length
  );
  controls.forEach((control) => {
    const box = control.getBoundingClientRect();
    const clashes = content.some((el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 6 || r.height < 6) return false;
      return !(
        r.right <= box.left ||
        box.right <= r.left ||
        r.bottom <= box.top ||
        box.bottom <= r.top
      );
    });
    if (clashes) control.classList.add('is-clashing');
  });
}

Reveal.initialize({
  hash: true,
  slideNumber: 'c/t',
  transition: 'fade',
  backgroundTransition: 'fade',
  controls: true,
  progress: true,
  center: false,
  touch: true,
  loop: false,
  keyboard: true,
  overview: true,
  width: 1920,
  height: 1080,
  margin: 0,
  minScale: 0.2,
  maxScale: 2.0,
});
Reveal.on('ready', (event) => guardFloatingControls(event.currentSlide));
Reveal.on('slidechanged', (event) => guardFloatingControls(event.currentSlide));
Reveal.on('resize', () => guardFloatingControls(Reveal.getCurrentSlide()));
