// Technology workshop kit: runs before reveal.js / knowall-deck.js.
// 1. Inlines the icon sprite (tw-icons.js) so icons show when a deck is opened
//    from a local file, where the browser blocks the external icons.svg.
// 2. Press N to show or hide the current slide's speaker notes
//    (<aside class="notes"> inside a slide). Notes never print.
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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'n' && e.key !== 'N') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    panel.hidden = !panel.hidden;
    showNotes();
  });

  window.addEventListener('load', () => {
    if (typeof Reveal !== 'undefined') Reveal.on('slidechanged', showNotes);
  });
})();
