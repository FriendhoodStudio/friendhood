// Shared body-scroll lock for full-screen overlays (services carousel, the
// reel modal) — without it, page scroll (wheel/trackpad, or a touch drag
// that starts on the backdrop rather than the overlay's own scrollable
// content) reaches through a `position:fixed` overlay to the page
// underneath, which is scrollable regardless of what's stacked on top of it.
//
// `overflow:hidden` on <html> alone handles this on desktop, but iOS Safari
// has a long-standing bug where it doesn't actually stop a touch-drag from
// scrolling the body behind a fixed overlay — the reliable cross-browser
// fix (the same one libraries like body-scroll-lock use) is to pin the body
// itself to `position:fixed` at its current scroll offset, then restore the
// real scroll position on unlock.
//
// Reference-counted rather than a plain boolean: if two overlays' open
// states ever end up overlapping (not a normal flow today, but nothing
// prevents it), one closing shouldn't re-enable scroll while the other is
// still open — only the last unlock actually restores it.
let lockCount = 0;
let savedScrollY = 0;
let savedHtmlOverflow = '';
let savedBodyPosition = '';
let savedBodyTop = '';
let savedBodyLeft = '';
let savedBodyRight = '';
let savedBodyWidth = '';

export function lockBodyScroll() {
  if (lockCount === 0) {
    savedScrollY = window.scrollY;
    // Locking removes the scrollbar, which would otherwise shift all
    // fixed-position content (the nav, this same overlay) sideways by its
    // width — `right` compensates so nothing visibly jumps.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    savedHtmlOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';

    savedBodyPosition = document.body.style.position;
    savedBodyTop = document.body.style.top;
    savedBodyLeft = document.body.style.left;
    savedBodyRight = document.body.style.right;
    savedBodyWidth = document.body.style.width;

    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedScrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '0';
    document.body.style.width = '100%';
  }
  lockCount++;
}

export function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.documentElement.style.overflow = savedHtmlOverflow;
    document.body.style.position = savedBodyPosition;
    document.body.style.top = savedBodyTop;
    document.body.style.left = savedBodyLeft;
    document.body.style.right = savedBodyRight;
    document.body.style.width = savedBodyWidth;
    // The body being position:fixed throughout the lock means the page
    // never actually scrolled — this is what makes it look like it did.
    window.scrollTo(0, savedScrollY);
  }
}
