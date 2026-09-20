// Scroll-scrubbed entrance (same technique as the hero's media/tagline
// parallax): opacity and translateY are a direct function of each item's
// position in the viewport, recomputed every scroll frame — so unlike a
// one-shot IntersectionObserver trigger, it's always in sync with the
// current scroll position and naturally replays every time you scroll past
// it, in either direction.
export interface ScrollRevealOptions {
  /** Stagger between items, as a slice of viewport height (scales with viewport). */
  staggerVh?: number;
  /** Progress 0 point, as a fraction of viewport height from the top. */
  startVh?: number;
  /** Progress 1 point, as a fraction of viewport height from the top. */
  endVh?: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function initScrollReveal(items: HTMLElement[], options: ScrollRevealOptions = {}) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!items.length || reduceMotion) return;

  const { staggerVh = 0.04, startVh = 0.92, endVh = 0.6 } = options;

  function update() {
    const vh = window.innerHeight;
    // Items near the end of the page can run out of room to scroll through
    // before reaching their "end" threshold — there's simply no more page
    // left below them to keep scrolling. Once the user has hit (or is
    // essentially at) the maximum scroll position, force full reveal rather
    // than leaving trailing items permanently stuck mid-fade.
    const maxScroll = document.documentElement.scrollHeight - vh;
    const atBottom = window.scrollY >= maxScroll - 1;

    // Stagger rank is each item's position among only the CURRENTLY VISIBLE
    // items, recomputed every call — not the fixed array index captured
    // once at init. An item can be dynamically hidden/reflowed after init
    // (e.g. the Work page's category filter hiding non-matching cards), and
    // a stagger delay based on stale original-DOM-order position becomes
    // actively wrong once that happens: a card that used to be #8 of 16
    // keeps waiting for "its turn" per that old position even after
    // filtering moves it up into row 1 of a 6-card grid, so it never reads
    // as revealed until a real scroll happens to satisfy the wrong math —
    // which is exactly what looked like cards vanishing/reappearing on
    // scroll after using the Work page's filter. Skipping hidden items
    // entirely (rather than still giving them a rank) also means they
    // don't consume a stagger slot a visible item should have.
    let visibleIndex = 0;
    items.forEach((el) => {
      if (el.style.display === 'none') return;
      const i = visibleIndex++;
      const rect = el.getBoundingClientRect();
      const offset = i * vh * staggerVh;
      const start = vh * startVh - offset;
      const end = vh * endVh - offset;
      const progress = atBottom ? 1 : clamp((start - rect.top) / (start - end), 0, 1);
      el.style.opacity = String(progress);
      el.style.translate = `0 ${(1 - progress) * 24}px`;
    });
  }

  let rafId = 0;
  const onScroll = () => {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      update();
      rafId = 0;
    });
  };
  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
}

/**
 * Finds a `[data-reveal-group="name"]` section and reveals its `.reveal-item`
 * children — the query-then-initScrollReveal pairing every section on the
 * site repeats verbatim, pulled into one place so it only has to be right once.
 */
export function initScrollRevealGroup(name: string, options?: ScrollRevealOptions) {
  const group = document.querySelector<HTMLElement>(`[data-reveal-group="${name}"]`);
  const items = group ? Array.from(group.querySelectorAll<HTMLElement>('.reveal-item')) : [];
  initScrollReveal(items, options);
}
