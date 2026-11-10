// Technology workshop kit: runs before reveal.js / knowall-deck.js.
// 1. Press N to show or hide the current slide's speaker notes
//    (<aside class="notes"> inside a slide). Notes never print.
// 2. Optional: if a page defines window.TW_ICONS (the icons.svg markup), the
//    sprite is inlined so icons still show when a copy of a deck is opened
//    from a local file, where browsers block the external icons.svg. The
//    site serves the decks over HTTP, so it doesn't need this and leaves
//    TW_ICONS unset.
(function () {
  if (window.TW_ICONS) {
    const holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    holder.setAttribute('aria-hidden', 'true');
    holder.innerHTML = window.TW_ICONS;
    document.body.prepend(holder);
    document.querySelectorAll('use').forEach((u) => {
      const href = u.getAttribute('href') || '';
      if (href.startsWith('icons.svg#')) u.setAttribute('href', href.slice('icons.svg'.length));
    });
  }

  const panel = document.createElement('div');
  panel.className = 'tw-notes-panel';
  panel.hidden = true;
  document.body.appendChild(panel);

  function showNotes() {
    if (panel.hidden || typeof Reveal === 'undefined') return;
    const slide = Reveal.getCurrentSlide();
    const notes = slide && slide.querySelector('aside.notes');
    panel.innerHTML =
      '<p class="tw-notes-title">Speaker notes &middot; press N to hide</p>' +
      (notes ? notes.innerHTML : '<p>No notes for this slide.</p>');
  }

  // Capture phase on window runs before reveal.js's own keydown listener on
  // the document, which maps N to "next slide": stop the event there so N
  // only toggles the notes and never moves the deck on.
  window.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'n' && e.key !== 'N') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      panel.hidden = !panel.hidden;
      showNotes();
    },
    true
  );

  window.addEventListener('load', () => {
    if (typeof Reveal !== 'undefined') Reveal.on('slidechanged', showNotes);
  });
})();
