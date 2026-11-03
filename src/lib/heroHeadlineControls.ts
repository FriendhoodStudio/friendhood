/** A little floating control bar over the hero headline, for visitors to play
 * with: it appears on hover (desktop only) with a grip to drag the headline
 * anywhere on screen and buttons to set it left, centre or right aligned.
 * Not saved anywhere — a reload puts it back. */

// How long the bar lingers after the cursor leaves the headline and bar.
const HIDE_DELAY_MS = 500;
// Gap between the bar and the top of the headline.
const BAR_GAP_PX = 10;

export function initHeadlineControls(headline: HTMLElement, bar: HTMLElement, onMove: () => void) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  const grip = bar.querySelector<HTMLElement>('[data-transport-grip]');
  const alignButtons = Array.from(bar.querySelectorAll<HTMLButtonElement>('[data-transport-align]'));
  if (!grip) return;

  bar.hidden = false;
  // The headline is otherwise click-through (pointer-events-none); it needs
  // to notice the cursor to bring the bar up.
  headline.style.pointerEvents = 'auto';

  let hideTimer = 0;
  let dragging = false;
  let hovering = false;

  // Centred just above the headline, wherever it currently sits. Positions
  // are relative to the bar's own positioned parent (the headline area).
  function positionBar() {
    const parent = (bar.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    if (!parent) return;
    const h = headline.getBoundingClientRect();
    bar.style.left = `${h.left - parent.left + h.width / 2 - bar.offsetWidth / 2}px`;
    bar.style.top = `${h.top - parent.top - bar.offsetHeight - BAR_GAP_PX}px`;
  }

  function show() {
    window.clearTimeout(hideTimer);
    positionBar();
    bar.classList.add('is-visible');
  }

  function scheduleHide() {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (!dragging && !hovering) bar.classList.remove('is-visible');
    }, HIDE_DELAY_MS);
  }

  for (const el of [headline, bar]) {
    el.addEventListener('pointerenter', () => {
      hovering = true;
      show();
    });
    el.addEventListener('pointerleave', () => {
      hovering = false;
      scheduleHide();
    });
  }

  // The headline changes width with every word, so the bar re-centres on it.
  new ResizeObserver(() => {
    if (bar.classList.contains('is-visible')) positionBar();
  }).observe(headline);

  function home() {
    return { x: Number(headline.dataset.homeX) || 0, y: Number(headline.dataset.homeY) || 0 };
  }

  function setHome(x: number, y: number) {
    headline.dataset.homeX = String(x);
    headline.dataset.homeY = String(y);
    headline.style.translate = `${x}px ${y}px`;
  }

  // Drag the grip to move the headline anywhere, kept on screen. Pointer
  // capture keeps the drag going even if the cursor outruns the bar.
  grip.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragging = true;
    grip.classList.add('is-dragging');
    grip.setPointerCapture(e.pointerId);
    const pointer = { x: e.clientX, y: e.clientY };
    const startHome = home();
    const startRect = headline.getBoundingClientRect();
    // How far the headline can travel from where the drag started before
    // any edge of it would leave the screen.
    const limits = {
      minX: -startRect.left,
      maxX: window.innerWidth - startRect.right,
      minY: -startRect.top,
      maxY: window.innerHeight - startRect.bottom,
    };

    const move = (ev: PointerEvent) => {
      const dx = Math.min(Math.max(ev.clientX - pointer.x, limits.minX), limits.maxX);
      const dy = Math.min(Math.max(ev.clientY - pointer.y, limits.minY), limits.maxY);
      setHome(startHome.x + dx, startHome.y + dy);
      positionBar();
      onMove();
    };
    const end = (ev: PointerEvent) => {
      dragging = false;
      grip.classList.remove('is-dragging');
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', end);
      grip.removeEventListener('pointercancel', end);
      if (grip.hasPointerCapture(ev.pointerId)) grip.releasePointerCapture(ev.pointerId);
      if (!hovering) scheduleHide();
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  });

  // Left / centre / right — how the headline's lines sit within it.
  function setAlign(align: string) {
    headline.style.textAlign = align;
    alignButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.transportAlign === align)));
    positionBar();
  }
  alignButtons.forEach((b) => b.addEventListener('click', () => setAlign(b.dataset.transportAlign ?? 'center')));
  setAlign('center');
}
