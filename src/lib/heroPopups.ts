import type { HeroPopUpImage } from '../types/hero';

/** A loose field of project images floats around the hero headline, blurred
 * and faded back, each drifting on its own slow loop. On each word change
 * one of them rises forward — sharpening and growing slightly — then sinks
 * back into the blur in one smooth movement. Every few words one floating image dissolves and
 * a new one drifts in elsewhere, so the set slowly changes. Images come from
 * a shuffled deck (every image shows once before any repeats), and nothing
 * ever overlaps the headline or another image. */

const FLOAT_COUNT_DESKTOP = 6;
const FLOAT_COUNT_MOBILE = 4;
// The reveal starts just behind the word's own 750ms roll (which peaks at
// ~525ms). It runs a little longer than one word (every 2000ms), so the next
// image starts rising as this one is still settling back — one continuous
// ebb and flow rather than separate pops.
const REVEAL_DELAY_MS = 300;
const REVEAL_MS = 3000;
// One floating image is swapped for a new one every this many words.
const SWAP_EVERY_WORDS = 3;
const FADE_IN_MS = 1200;
const FADE_OUT_MS = 800;
// How far each image wanders from its spot while floating. The spacing
// below allows for two neighbours drifting towards each other at once.
const DRIFT_PX = 6;
const HEADLINE_CLEARANCE_PX = 16 + DRIFT_PX;
const IMAGE_GAP_PX = 8 + DRIFT_PX * 2;
// Kept clear around the edge of the hero so the blur (up to 24px while
// fading) can spill softly past it instead of being sliced off by the edge.
const EDGE_INSET_PX = 32;
const PLACEMENT_ATTEMPTS = 60;

const RESTING: Keyframe = { transform: 'scale(0.92)', opacity: 0.45, filter: 'blur(14px)' };

interface Floater {
  wrap: HTMLElement;
  card: HTMLElement;
  rect: DOMRect;
}

export function initHeroPopups(layer: HTMLElement, headline: HTMLElement, images: HeroPopUpImage[]) {
  if (images.length < 2) return null;

  let deck: HeroPopUpImage[] = [];
  const preloaded = new Map<string, HTMLImageElement>();
  let floaters: Floater[] = [];
  // Spots still held by images that are dissolving away, so a new one can't
  // land on top of them mid-fade.
  let fading: Floater[] = [];
  let lastRevealed: Floater | null = null;
  let wordCount = 0;
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
    // Warm the next one so it's decoded by the next swap.
    if (deck.length > 0) preload(deck[deck.length - 1]);
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

  function imageHeight(layerRect: DOMRect) {
    const mobile = layerRect.width < 768;
    const base = mobile
      ? Math.min(150, Math.max(96, layerRect.height * 0.17))
      : Math.min(250, Math.max(140, layerRect.height * 0.26));
    // Varied a little so the field doesn't read as a grid of equal tiles.
    return base * (0.75 + Math.random() * 0.25);
  }

  function intersects(a: DOMRect, b: DOMRect, gap: number) {
    return a.left < b.right + gap && b.left < a.right + gap && a.top < b.bottom + gap && b.top < a.bottom + gap;
  }

  // A random spot anywhere in the hero that's clear of the headline and of
  // every other floating image. Null if there's no room left. Positions are
  // layer-relative.
  function place(width: number, height: number): DOMRect | null {
    const layerRect = layer.getBoundingClientRect();
    const h = headline.getBoundingClientRect();
    const headlineRect = new DOMRect(h.left - layerRect.left, h.top - layerRect.top, h.width, h.height);
    const minX = EDGE_INSET_PX;
    const minY = EDGE_INSET_PX;
    const maxX = layerRect.width - width - EDGE_INSET_PX;
    const maxY = layerRect.height - height - EDGE_INSET_PX;
    if (maxX < minX || maxY < minY) return null;

    for (let i = 0; i < PLACEMENT_ATTEMPTS; i++) {
      const rect = new DOMRect(minX + Math.random() * (maxX - minX), minY + Math.random() * (maxY - minY), width, height);
      if (intersects(rect, headlineRect, HEADLINE_CLEARANCE_PX)) continue;
      if ([...floaters, ...fading].some((f) => intersects(rect, f.rect, IMAGE_GAP_PX))) continue;
      return rect;
    }
    return null;
  }

  async function addFloater(delay = 0) {
    const image = draw();
    const source = preload(image);
    try {
      await source.decode();
    } catch {
      return; // Failed or still loading on a slow connection — skip it.
    }

    const layerRect = layer.getBoundingClientRect();
    const height = imageHeight(layerRect);
    // Clamped so very tall or panoramic images still read as photos.
    const width = height * Math.min(1.6, Math.max(0.7, image.aspectRatio));
    const rect = place(width, height);
    if (!rect) return;

    // Two layers: the outer one drifts (a slow CSS loop with its own random
    // direction and speed), the inner card blurs, fades and pops — so the
    // reveal never fights the drift.
    const wrap = document.createElement('div');
    wrap.className = 'hero-float';
    wrap.style.cssText =
      `left:${rect.x}px;top:${rect.y}px;width:${width}px;height:${height}px;` +
      `--drift-x:${(Math.random() < 0.5 ? -1 : 1) * DRIFT_PX * (0.6 + Math.random() * 0.4)}px;` +
      `--drift-y:${(Math.random() < 0.5 ? -1 : 1) * DRIFT_PX * (0.6 + Math.random() * 0.4)}px;` +
      `--drift-rotate:${(Math.random() * 2 - 1) * 0.5}deg;` +
      `--drift-duration:${10 + Math.random() * 6}s;animation-delay:${-Math.random() * 16}s`;
    const card = document.createElement('div');
    card.className = 'hero-popup';
    const img = document.createElement('img');
    img.src = image.url;
    img.alt = '';
    card.appendChild(img);
    wrap.appendChild(card);
    layer.appendChild(wrap);
    const floater = { wrap, card, rect };
    floaters.push(floater);

    card.animate([{ transform: 'scale(0.8)', opacity: 0, filter: 'blur(24px)' }, RESTING], {
      duration: FADE_IN_MS,
      delay,
      easing: 'ease-out',
      fill: 'both',
    });
  }

  function removeFloater(floater: Floater) {
    floaters = floaters.filter((f) => f !== floater);
    fading.push(floater);
    if (lastRevealed === floater) lastRevealed = null;
    const done = () => {
      floater.wrap.remove();
      fading = fading.filter((f) => f !== floater);
    };
    floater.card
      .animate([RESTING, { transform: 'scale(0.85)', opacity: 0, filter: 'blur(24px)' }], {
        duration: FADE_OUT_MS,
        easing: 'ease-in',
        fill: 'forwards',
      })
      .finished.then(done)
      .catch(done);
  }

  // One smooth rise and fall: sharpens and grows forward, then sinks straight
  // back into the blur, with no hold or settle in between.
  function reveal() {
    const candidates = floaters.filter((f) => f !== lastRevealed);
    if (candidates.length === 0) return;
    const floater = candidates[Math.floor(Math.random() * candidates.length)];
    lastRevealed = floater;
    floater.wrap.style.zIndex = '1';
    floater.card
      .animate(
        [
          { ...RESTING, easing: 'ease-in-out' },
          { transform: 'scale(1.06)', opacity: 1, filter: 'blur(0px)', offset: 0.5, easing: 'ease-in-out' },
          RESTING,
        ],
        { duration: REVEAL_MS }
      )
      .finished.then(() => (floater.wrap.style.zIndex = ''))
      .catch(() => {});
  }

  function build() {
    [...floaters, ...fading].forEach((f) => f.wrap.remove());
    floaters = [];
    fading = [];
    lastRevealed = null;
    const count = layer.getBoundingClientRect().width < 768 ? FLOAT_COUNT_MOBILE : FLOAT_COUNT_DESKTOP;
    for (let i = 0; i < count; i++) addFloater(i * 150);
  }

  // Pauses reveals and swaps while the hero is scrolled away or the tab is
  // hidden; the field itself just keeps drifting.
  new IntersectionObserver(([entry]) => {
    heroInView = entry.isIntersecting;
  }).observe(layer);

  // Laid out once the real fonts are in, so the headline's box (which the
  // field keeps clear of) is its final size; rebuilt after a resize settles,
  // since the free space around the headline changes with it.
  document.fonts.ready.then(build);
  let resizeTimer = 0;
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    // Mobile browsers fire resize as the URL bar shows/hides; only a real
    // width change moves the headline enough to matter.
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 300);
  });

  return {
    onWordAdvance() {
      if (!heroInView || document.hidden) return;
      wordCount++;
      window.setTimeout(reveal, REVEAL_DELAY_MS);
      if (wordCount % SWAP_EVERY_WORDS === 0) {
        // Swaps one that isn't about to be revealed, after the reveal is
        // underway, so the two never happen to the same image.
        window.setTimeout(() => {
          const candidates = floaters.filter((f) => f !== lastRevealed);
          if (candidates.length === 0) return;
          removeFloater(candidates[Math.floor(Math.random() * candidates.length)]);
          addFloater(FADE_OUT_MS / 2);
        }, REVEAL_DELAY_MS + 200);
      }
    },
  };
}
