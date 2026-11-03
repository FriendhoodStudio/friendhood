import type { HeroPopUpImage } from '../types/hero';

/** Two project images roll up into view around the hero headline just after
 * each word change, using the same roll-and-overshoot language as the word
 * itself, so the two read as one motion rather than separate effects. Images
 * come from a shuffled deck (every image shows once before any repeats), and
 * the oldest pair rolls back out as each new pair arrives so the hero never
 * holds more than two pairs. */

// Delays after the word starts rolling (its own roll is 650ms, peaking at
// ~455ms): the first image lands just behind the word, the second follows.
const PAIR_DELAYS_MS = [320, 520];
const ROLL_IN_MS = 650;
const ROLL_OUT_MS = 450;
const MAX_VISIBLE = 4;
// Padding kept clear around the headline, the gap kept between images (so
// a pair doesn't butt together into one strip), and how much a crowded
// layout may overlap before a spot is rejected outright.
const HEADLINE_CLEARANCE_PX = 16;
const IMAGE_GAP_PX = 12;
const MAX_OVERLAP_FRACTION = 0.05;
const PLACEMENT_ATTEMPTS = 40;

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
    // Warm the following pair so they've decoded by the next word change.
    deck.slice(-2).forEach((image) => preload(image));
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

  function overlapArea(a: DOMRect, b: DOMRect) {
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    return w > 0 && h > 0 ? w * h : 0;
  }

  // Random spots inside the layer that stay clear of the headline and
  // mostly clear of images already showing. Positions are layer-relative.
  function place(width: number, height: number): DOMRect | null {
    const layerRect = layer.getBoundingClientRect();
    const h = headline.getBoundingClientRect();
    const keepClear = new DOMRect(
      h.left - layerRect.left - HEADLINE_CLEARANCE_PX,
      h.top - layerRect.top - HEADLINE_CLEARANCE_PX,
      h.width + HEADLINE_CLEARANCE_PX * 2,
      h.height + HEADLINE_CLEARANCE_PX * 2
    );
    const maxX = layerRect.width - width;
    const maxY = layerRect.height - height;
    if (maxX < 0 || maxY < 0) return null;

    let best: { rect: DOMRect; score: number } | null = null;
    for (let i = 0; i < PLACEMENT_ATTEMPTS; i++) {
      const rect = new DOMRect(Math.random() * maxX, Math.random() * maxY, width, height);
      if (overlapArea(rect, keepClear) > 0) continue;
      const padded = new DOMRect(rect.x - IMAGE_GAP_PX, rect.y - IMAGE_GAP_PX, width + IMAGE_GAP_PX * 2, height + IMAGE_GAP_PX * 2);
      const overlap = visible.reduce((sum, p) => sum + overlapArea(padded, p.rect), 0) / (width * height);
      if (overlap <= MAX_OVERLAP_FRACTION) return rect;
      if (!best || overlap < best.score) best = { rect, score: overlap };
    }
    return best?.rect ?? null;
  }

  function rollOut(popup: Popup) {
    const index = visible.indexOf(popup);
    if (index >= 0) visible.splice(index, 1);
    const img = popup.el.firstElementChild as HTMLElement;
    img
      .animate([{ transform: 'translateY(0) scale(1.08)' }, { transform: 'translateY(-105%) scale(1.08)' }], {
        duration: ROLL_OUT_MS,
        easing: 'cubic-bezier(0.55, 0, 0.75, 0.3)',
        fill: 'forwards',
      })
      .finished.then(() => popup.el.remove())
      .catch(() => popup.el.remove());
  }

  async function spawn() {
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
    const rect = place(width, height);
    if (!rect) return;

    while (visible.length >= MAX_VISIBLE) rollOut(visible[0]);

    const el = document.createElement('div');
    el.className = 'hero-popup';
    el.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${width}px;height:${height}px`;
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = '';
    el.appendChild(img);
    layer.appendChild(el);
    const popup = { el, rect };
    visible.push(popup);

    // Rolls up from below its own mask, overshooting slightly then settling
    // — the same keyframe shape as the headline word's roll. scale(1.08)
    // keeps the overshoot from showing an empty strip at the mask's bottom.
    img.animate(
      [
        { transform: 'translateY(105%) scale(1.08)' },
        { transform: 'translateY(-4%) scale(1.08)', offset: 0.7 },
        { transform: 'translateY(1%) scale(1.08)', offset: 0.88 },
        { transform: 'translateY(0) scale(1.08)' },
      ],
      { duration: ROLL_IN_MS, easing: 'ease-out', fill: 'forwards' }
    );
  }

  // Pauses while the hero is scrolled away or the tab is hidden, so pairs
  // don't pile up off-screen.
  new IntersectionObserver(([entry]) => {
    heroInView = entry.isIntersecting;
  }).observe(layer);

  shuffle();
  deck.slice(-2).forEach((image) => preload(image));

  return {
    onWordAdvance() {
      if (!heroInView || document.hidden) return;
      PAIR_DELAYS_MS.forEach((delay) => window.setTimeout(spawn, delay));
    },
  };
}
