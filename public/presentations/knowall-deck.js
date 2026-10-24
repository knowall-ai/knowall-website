// Shared runtime for the KnowAll AI presentation decks. Loaded by every deck
// after reveal.js. Behaviour only — the matching styles (floating CTA pill,
// image drift) live in knowall-deck.css alongside the rest of the house style.

// --- Per-slide call to action -------------------------------------------
// Every content slide carries a floating call-to-action pill; the cover, the
// slide after it and the closing CTA slide stay clean. A deck can change the
// pill with attributes on <body>:
//   <body data-cta-label="Book a Security Discovery"
//         data-cta-href="https://www.knowall.ai/purple-team#enquire">
const deckSlides = Array.from(document.querySelectorAll('.reveal .slides > section'));
const ctaLabel = document.body.dataset.ctaLabel || 'Book a working session';
const ctaHref = document.body.dataset.ctaHref || 'https://www.knowall.ai/#contact';
deckSlides.slice(2, -1).forEach((slide) => {
  const cta = document.createElement('a');
  cta.className = 'slide-cta';
  cta.href = ctaHref;
  cta.setAttribute('aria-label', `${ctaLabel} with KnowAll AI`);
  cta.textContent = ctaLabel;
  slide.append(cta);
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
    ['.human-row > .human', 'fade-up'],
    ['.agent-row > .agent', 'fade-up'],
    ['.timeline > .timeline-point', 'fade-up'],
    ['.kpi-row > .kpi', 'fade-in'],
    ['.pill-row > .pill', 'fade-in'],
    ['.lifecycle-stages > .ls', 'fade-in'],
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
  '.card, .check, .kpi, .pill, .stage, .agent, .human, .timeline-point, .ls,' +
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
/**
 * Run the clash check only once the entry sequence has settled.
 *
 * `.seq` items animate in from `translateY(16px)` with a delay of up to
 * 0.16s per item, and getBoundingClientRect() reports the *transformed* rect.
 * Measuring on `ready`/`slidechanged` therefore sees every item 16px lower
 * than where it comes to rest — 16px closer to the pill — so slides whose
 * content ends just above the pill were reported as clashing when the settled
 * layout is fine, and the pill was hidden for no reason.
 *
 * Only `seq-in` animations are awaited. `deck-drift` runs for 30s on hero
 * imagery, so waiting for *every* animation on the slide would delay the
 * measurement by half a minute on those slides. Reduced-motion users have no
 * `seq-in` animations at all, so this resolves immediately for them.
 */
function whenSequenceSettled(slide) {
  if (typeof slide.getAnimations !== 'function') return Promise.resolve();
  const entry = slide
    .getAnimations({ subtree: true })
    .filter((animation) => animation.animationName === 'seq-in');
  if (!entry.length) return Promise.resolve();
  // A cancelled animation rejects `finished` (e.g. the deck moves on mid-flight);
  // swallow it, the current-slide check below decides whether to measure.
  return Promise.all(entry.map((animation) => animation.finished.catch(() => {})));
}

function guardWhenSettled(slide) {
  if (!slide) return;
  whenSequenceSettled(slide).then(() => {
    // The deck may have advanced while we waited — only measure what's on screen.
    if (Reveal.getCurrentSlide() === slide) guardFloatingControls(slide);
  });
}

Reveal.on('ready', (event) => guardWhenSettled(event.currentSlide));
Reveal.on('slidechanged', (event) => guardWhenSettled(event.currentSlide));
Reveal.on('resize', () => guardWhenSettled(Reveal.getCurrentSlide()));

// --- Carousels (opt-in) ---------------------------------------------------
// Markup and styles: see "Carousel" in knowall-deck.css. Each .carousel
// auto-advances (every data-carousel-interval ms, default 4500) only while
// its slide is on screen, never under prefers-reduced-motion, and pauses
// while the visitor hovers or focuses it (WCAG 2.2.2). The arrows and dots
// always work, and never move the deck.
document.querySelectorAll('.carousel').forEach((root) => {
  const slides = [...root.querySelectorAll('.carousel-slide')];
  const dots = [...root.querySelectorAll('.carousel-dot')];
  if (!slides.length) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const interval = Number(root.dataset.carouselInterval) || 4500;
  let i = 0;
  let timer = null;
  const show = (n) => {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => {
      s.classList.toggle('is-active', k === i);
      s.setAttribute('aria-hidden', String(k !== i));
    });
    dots.forEach((d, k) => {
      d.classList.toggle('is-active', k === i);
      d.setAttribute('aria-current', String(k === i));
    });
  };
  const stop = () => {
    clearInterval(timer);
    timer = null;
  };
  const start = () => {
    if (!still && !timer) timer = setInterval(() => show(i + 1), interval);
  };
  const onSlide = () => (Reveal.getCurrentSlide()?.contains(root) ? start() : stop());
  root.querySelector('.carousel-prev')?.addEventListener('click', () => {
    stop();
    show(i - 1);
  });
  root.querySelector('.carousel-next')?.addEventListener('click', () => {
    stop();
    show(i + 1);
  });
  dots.forEach((d, k) =>
    d.addEventListener('click', () => {
      stop();
      show(k);
    })
  );
  // keep the deck's own keyboard and swipe handling away from the controls
  root
    .querySelectorAll('button')
    .forEach((b) => b.addEventListener('keydown', (e) => e.stopPropagation()));
  Reveal.on('ready', onSlide);
  // Pause while the visitor is looking at or using it (WCAG 2.2.2).
  root.addEventListener('mouseenter', stop);
  root.addEventListener('focusin', stop);
  root.addEventListener('mouseleave', onSlide);
  Reveal.on('slidechanged', onSlide);
  if (Reveal.isReady()) onSlide();
});
