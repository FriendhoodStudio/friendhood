import type { HeroPopUpImage } from '../types/hero';

/** Two project images grow in around the hero headline just after each word
 * change, with the same overshoot-and-settle as the site's buttons and the
 * word's own width change, and shrink away the moment the next word starts —
 * so each pair belongs to exactly one word. Images come from a shuffled deck
 * (every image shows once before any repeats). */

// Delays after the word starts rolling (its own roll is 650ms, peaking at
// ~455ms): the first image lands just behind the word, the second follows.
const PAIR_DELAYS_MS = [320, 520];
const GROW_IN_MS = 650;
const SHRINK_OUT_MS = 250;
// Padding kept clear around the headline.
const HEADLINE_CLEARANCE_PX = 16;

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

  // A pair is composed rather than scattered: one image in the band above
  // the headline, one in the band below, on opposite sides (which side
  // alternates each word), so it always reads as a balanced diagonal. The
  // exact spot within that quarter is random so it still feels loose.
  // Positions are layer-relative.
  function place(width: number, height: number, slot: 'top' | 'bottom', side: 'left' | 'right'): DOMRect | null {
    const layerRect = layer.getBoundingClientRect();
    const h = headline.getBoundingClientRect();
    const clearTop = h.top - layerRect.top - HEADLINE_CLEARANCE_PX;
    const clearBottom = h.bottom - layerRect.top + HEADLINE_CLEARANCE_PX;

    const [minY, maxY] = slot === 'top' ? [0, clearTop - height] : [clearBottom, layerRect.height - height];
    if (maxY < minY) return null;

    const half = layerRect.width / 2;
    const [minX, maxX] =
      side === 'left' ? [0, Math.max(0, half - width)] : [Math.min(half, layerRect.width - width), layerRect.width - width];

    return new DOMRect(minX + Math.random() * (maxX - minX), minY + Math.random() * (maxY - minY), width, height);
  }

  // Quick shrink-and-fade as the next word starts, clearing the way for the
  // next pair.
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

  async function spawn(slot: 'top' | 'bottom', side: 'left' | 'right') {
    const image = draw();
    const source = preload(image);
    try {
      await source.decode();
    } catch {
      return; // Failed or still loading on a slow connection — skip this one.
    }

    const layerRect = layer.getBoundingClientRect();
    const h = headline.getBoundingClientRect();
    // Shrunk to fit if the band above/below the headline is short.
    const band =
      slot === 'top' ? h.top - layerRect.top : layerRect.bottom - h.bottom;
    const height = Math.min(popupHeight(layerRect), band - HEADLINE_CLEARANCE_PX);
    // Clamped so very tall or panoramic images still read as photos.
    const width = height * Math.min(1.6, Math.max(0.7, image.aspectRatio));
    const rect = place(width, height, slot, side);
    if (!rect) return;

    const el = document.createElement('div');
    el.className = 'hero-popup';
    el.style.cssText = `left:${rect.x}px;top:${rect.y}px;width:${width}px;height:${height}px`;
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = '';
    el.appendChild(img);
    layer.appendChild(el);
    visible.push({ el, rect });

    // Grows past full size then settles back, fading in over the first part
    // — the same keyframe shape as the headline word's width change and the
    // nav/footer button release.
    el.animate(
      [
        { transform: 'scale(0.4)', opacity: 0 },
        { transform: 'scale(1.06)', opacity: 1, offset: 0.6 },
        { transform: 'scale(0.98)', opacity: 1, offset: 0.85 },
        { transform: 'scale(1)', opacity: 1 },
      ],
      { duration: GROW_IN_MS, easing: 'ease-out', fill: 'both' }
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
      clearVisible();
      if (!heroInView || document.hidden) return;
      topSide = topSide === 'left' ? 'right' : 'left';
      const bottomSide = topSide === 'left' ? 'right' : 'left';
      window.setTimeout(() => spawn('top', topSide), PAIR_DELAYS_MS[0]);
      window.setTimeout(() => spawn('bottom', bottomSide), PAIR_DELAYS_MS[1]);
    },
  };
}
