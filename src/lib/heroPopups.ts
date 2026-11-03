import type { HeroPopUpImage } from '../types/hero';

/** Three project images grow in around the hero headline just after each
 * word change — two hugging its edges, one anywhere — with the same overshoot-and-settle as the site's buttons and the
 * word's own width change, then shrink and fade straight back out — so each
 * set belongs to exactly one word. Images come from a shuffled deck
 * (every image shows once before any repeats). */

// Delays after the word starts rolling (its own roll is 750ms, peaking at
// ~525ms): the first image lands just behind the word, the others follow.
const SPAWN_DELAYS_MS = [300, 450, 600];
// One continuous grow, overshoot, settle and fade — no hold — short enough
// that all three are gone before the next word (every 2000ms) arrives.
const LIFETIME_MS = 1250;
// Minimum space kept between the headline and the two images framing it.
const HEADLINE_CLEARANCE_PX = 16;
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
      ? Math.min(172, Math.max(110, layerRect.height * 0.2))
      : Math.min(300, Math.max(172, layerRect.height * 0.31));
  }

  // The first two of each set are composed rather than scattered: one in the
  // space above the headline, one in the space below, on opposite halves
  // (which side alternates each word), so it reads as a balanced diagonal.
  // The exact spot within that quarter is random so it still feels loose.
  // The third lands anywhere, so it's the one that can pass over the text.
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
    const clearTop = h.top - layerRect.top - HEADLINE_CLEARANCE_PX;
    const clearBottom = h.bottom - layerRect.top + HEADLINE_CLEARANCE_PX;
    const [minY, maxY] = slot === 'top' ? [0, clearTop - height] : [clearBottom, layerRect.height - height];

    const half = layerRect.width / 2;
    const [minX, maxX] =
      side === 'left' ? [0, Math.max(0, half - width)] : [Math.min(half, layerRect.width - width), layerRect.width - width];

    return new DOMRect(
      minX + Math.random() * (maxX - minX),
      minY + Math.random() * Math.max(0, maxY - minY),
      width,
      height
    );
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
    const h = headline.getBoundingClientRect();
    // The framing images shrink to fit if the space above/below is short.
    const band = slot === 'top' ? h.top - layerRect.top : slot === 'bottom' ? layerRect.bottom - h.bottom : Infinity;
    const height = Math.min(popupHeight(layerRect), band - HEADLINE_CLEARANCE_PX);
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
