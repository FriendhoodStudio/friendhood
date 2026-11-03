import type { HeroPopUpImage } from '../types/hero';

/** Three project images grow in around the hero headline just after each
 * word change — two hugging its edges, one anywhere — with the same overshoot-and-settle as the site's buttons and the
 * word's own width change, then shrink and fade straight back out — so each
 * set belongs to exactly one word. Images come from a shuffled deck
 * (every image shows once before any repeats). */

// Delays after the word starts rolling (its own roll is 650ms, peaking at
// ~455ms): the first image lands just behind the word, the others follow.
const SPAWN_DELAYS_MS = [250, 400, 550];
// One continuous grow, overshoot, settle and fade — no hold — short enough
// that both images are gone before the next word (every 1500ms) arrives.
const LIFETIME_MS = 950;
const SHRINK_OUT_MS = 250;

type Slot = 'top' | 'bottom' | 'anywhere';

interface Popup {
  el: HTMLElement;
  rect: DOMRect;
}

export function initHeroPopups(layer: HTMLElement, headline: HTMLElement, images: HeroPopUpImage[]) {
  if (images.length < 2) return null;

  let deck: HeroPopUpImage[] = [];
  const preloaded = new Map<string, HTMLImageElement>();
  const visible: Popup[] = [];
  let heroInView = true;
  let topSide: 'left' | 'right' = Math.random() < 0.5 ? 'left' : 'right';

  function shuffle() {
    deck = [...images];
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  function draw(): HeroPopUpImage {
    if (deck.length === 0) shuffle();
    const next = deck.pop()!;
    // Warm the following set so they've decoded by the next word change.
    deck.slice(-3).forEach((image) => preload(image));
    return next;
  }

  function preload(image: HeroPopUpImage) {
    if (preloaded.has(image.url)) return preloaded.get(image.url)!;
    const img = new Image();
    img.decoding = 'async';
    img.src = image.url;
    preloaded.set(image.url, img);
    return img;
  }

  function popupHeight(layerRect: DOMRect) {
    const mobile = layerRect.width < 768;
    return mobile
      ? Math.min(150, Math.max(96, layerRect.height * 0.17))
      : Math.min(260, Math.max(150, layerRect.height * 0.27));
  }

  // The first two of each set are composed rather than scattered: one hugging the top
  // edge of the headline, one the bottom edge, on opposite sides (which side
  // alternates each word), so it reads as a balanced diagonal. Each overlaps
  // the headline's edge by a random amount and sits in front of the text —
  // they're only fully visible for a moment, so it never blocks it for long.
  // Positions are layer-relative.
  function place(width: number, height: number, slot: Slot, side: 'left' | 'right'): DOMRect {
    const layerRect = layer.getBoundingClientRect();
    // The third image of each set: anywhere in the hero.
    if (slot === 'anywhere') {
      return new DOMRect(
        Math.random() * Math.max(0, layerRect.width - width),
        Math.random() * Math.max(0, layerRect.height - height),
        width,
        height
      );
    }
    const h = headline.getBoundingClientRect();
    const left = h.left - layerRect.left;
    const top = h.top - layerRect.top;

    // Centre somewhere along that side's half of the headline, reaching a
    // little past its outer end.
    const centreX =
      side === 'left'
        ? left - width * 0.25 + Math.random() * (h.width * 0.45)
        : left + h.width * 0.55 + Math.random() * (h.width * 0.45 + width * 0.25);
    // Between half on and fully off the headline's top/bottom edge.
    const reach = height * (0.1 + Math.random() * 0.4);
    const centreY = slot === 'top' ? top - reach : top + h.height + reach;

    const x = Math.min(Math.max(centreX - width / 2, 0), layerRect.width - width);
    const y = Math.min(Math.max(centreY - height / 2, 0), layerRect.height - height);
    return new DOMRect(x, y, width, height);
  }

  // Safety net for a set still fading when the next word starts (e.g. a
  // slow image decode delayed it): finishes it off quickly.
  function clearVisible() {
    visible.splice(0).forEach(({ el }) => {
      el.getAnimations().forEach((anim) => anim.commitStyles?.());
      el.getAnimations().forEach((anim) => anim.cancel());
      el.animate([{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(0.85)', opacity: 0 }], {
        duration: SHRINK_OUT_MS,
        easing: 'ease-in',
        fill: 'forwards',
      })
        .finished.then(() => el.remove())
        .catch(() => el.remove());
    });
  }

  async function spawn(slot: Slot, side: 'left' | 'right') {
    const image = draw();
    const source = preload(image);
    try {
      await source.decode();
    } catch {
      return; // Failed or still loading on a slow connection — skip this one.
    }

    const layerRect = layer.getBoundingClientRect();
    const height = popupHeight(layerRect);
    // Clamped so very tall or panoramic images still read as photos.
    const width = height * Math.min(1.6, Math.max(0.7, image.aspectRatio));
    const rect = place(width, height, slot, side);

    const el = document.createElement('div');
    el.className = 'hero-popup';
    el.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${width}px;height:${height}px`;
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = '';
    el.appendChild(img);
    layer.appendChild(el);
    visible.push({ el, rect });

    // Grows past full size (the same overshoot as the headline word's width
    // change and the nav/footer button release), then keeps shrinking
    // straight on into the fade — never resting at full size, so it's always
    // moving. Blurred at both ends so the fades read soft, not as a cut.
    const anim = el.animate(
      [
        { transform: 'scale(0.4)', opacity: 0, filter: 'blur(12px)', easing: 'ease-out' },
        { transform: 'scale(1.06)', opacity: 1, filter: 'blur(0px)', offset: 0.38, easing: 'ease-in' },
        { transform: 'scale(0.98)', opacity: 1, filter: 'blur(0px)', offset: 0.62, easing: 'linear' },
        { transform: 'scale(0.8)', opacity: 0, filter: 'blur(12px)' },
      ],
      { duration: LIFETIME_MS, fill: 'both' }
    );
    anim.finished
      .then(() => {
        const index = visible.findIndex((p) => p.el === el);
        if (index >= 0) visible.splice(index, 1);
        el.remove();
      })
      .catch(() => {});
  }

  // Pauses while the hero is scrolled away or the tab is hidden, so sets
  // don't pile up off-screen.
  new IntersectionObserver(([entry]) => {
    heroInView = entry.isIntersecting;
  }).observe(layer);

  shuffle();
  deck.slice(-3).forEach((image) => preload(image));

  return {
    onWordAdvance() {
      clearVisible();
      if (!heroInView || document.hidden) return;
      topSide = topSide === 'left' ? 'right' : 'left';
      const bottomSide = topSide === 'left' ? 'right' : 'left';
      window.setTimeout(() => spawn('top', topSide), SPAWN_DELAYS_MS[0]);
      window.setTimeout(() => spawn('bottom', bottomSide), SPAWN_DELAYS_MS[1]);
      window.setTimeout(() => spawn('anywhere', topSide), SPAWN_DELAYS_MS[2]);
    },
  };
}
