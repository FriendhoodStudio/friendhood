import type { HeroPopUpImage } from '../types/hero';

/** A loose field of project images floats around the hero headline, blurred
 * and faded back, each drifting on its own slow loop — one per headline word,
 * each word cycling through its own set of three. When a word comes up, its
 * image rises forward — sharpening and growing slightly — and sinks back in
 * one smooth movement; then it dissolves and the word's next image drifts in,
 * waiting for the word to come round again. Each newcomer lands in a random spot and its neighbours glide
 * aside to make room, so the field gently re-jostles. Images come from a
 * shuffled deck (every image shows once before any repeats), and nothing
 * overlaps the headline or another image. */

// How many images each word cycles through, one on screen at a time.
const IMAGES_PER_WORD = 3;
// The word's image rises just behind the word's own 750ms roll (which
// peaks at ~525ms).
const REVEAL_DELAY_MS = 300;
const REVEAL_MS = 3000;
const FADE_IN_MS = 1200;
const FADE_OUT_MS = 800;
// How long neighbours take to glide aside for a newcomer.
const JOSTLE_MS = 1400;
// How far each image wanders from its spot while floating. The spacing
// below allows for two neighbours drifting towards each other at once.
const DRIFT_PX = 6;
const HEADLINE_CLEARANCE_PX = 16 + DRIFT_PX;
const IMAGE_GAP_PX = 8 + DRIFT_PX * 2;
// Kept clear around the edge of the hero so the blur (up to 24px while
// fading) can spill softly past it instead of being sliced off by the edge.
const EDGE_INSET_PX = 32;
// Share of the free space around the headline the field fills — sets the
// image size, so it scales with the number of words and the screen.
const FIELD_COVERAGE = 0.3;
const RELAX_ITERATIONS = 150;
// Random spots tried when picking the most open place for an image.
const SPOT_CANDIDATES = 40;
// How far a newcomer's nudge reaches (as a multiple of its diagonal) and
// the most any neighbour is pushed by it.
const JOSTLE_REACH = 2.2;
const JOSTLE_MAX_PX = 70;
const JOSTLE_STRENGTHS = [1, 0.6, 0.35];
// How big an image grows as it rises into focus. It sits behind the
// headline, so growing near it never covers the text.
const REVEAL_SCALE = 1.5;

const RESTING: Keyframe = { transform: 'scale(0.92)', opacity: 0.45, filter: 'blur(14px)' };

interface Floater {
  wrap: HTMLElement;
  card: HTMLElement;
  word: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function initHeroPopups(layer: HTMLElement, headline: HTMLElement, images: HeroPopUpImage[], wordCount: number) {
  if (images.length < 2 || wordCount < 1) return null;

  let deck: HeroPopUpImage[] = [];
  const preloaded = new Map<string, HTMLImageElement>();
  let floaters: Floater[] = [];
  let heroInView = true;
  let baseHeight = 0;
  // Each word's own set of images, and which one it shows next.
  const wordImages: HeroPopUpImage[][] = [];
  const wordNext: number[] = [];
  let currentWord = 0;

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

  function bounds() {
    const layerRect = layer.getBoundingClientRect();
    const h = headline.getBoundingClientRect();
    return {
      width: layerRect.width,
      height: layerRect.height,
      headline: {
        x: h.left - layerRect.left - HEADLINE_CLEARANCE_PX,
        y: h.top - layerRect.top - HEADLINE_CLEARANCE_PX,
        w: h.width + HEADLINE_CLEARANCE_PX * 2,
        h: h.height + HEADLINE_CLEARANCE_PX * 2,
      },
    };
  }

  // Sized so the whole field (every word's images) fills a set share of the
  // free space around the headline, whatever the screen or word count.
  function measureBaseHeight() {
    const b = bounds();
    const free = Math.max(0, (b.width - EDGE_INSET_PX * 2) * (b.height - EDGE_INSET_PX * 2) - b.headline.w * b.headline.h);
    const perImage = (free * FIELD_COVERAGE) / wordCount;
    // Area = h × (h × ~1.3 average aspect), solved for h.
    const mobile = b.width < 768;
    baseHeight = Math.min(mobile ? 120 : 240, Math.max(mobile ? 64 : 110, Math.sqrt(perImage / 1.3)));
  }

  type Box = { x: number; y: number; w: number; h: number };
  const centre = (r: Box) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  // Edge-to-edge gap between two boxes (negative when they overlap).
  function gapBetween(a: Box, b: Box) {
    const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
  }

  function clampToEdges(f: Floater) {
    const b = bounds();
    f.x = Math.min(Math.max(f.x, EDGE_INSET_PX), b.width - f.w - EDGE_INSET_PX);
    f.y = Math.min(Math.max(f.y, EDGE_INSET_PX), b.height - f.h - EDGE_INSET_PX);
  }

  // The most open of a batch of random spots: the one furthest from the
  // headline and every other image. Spreads the field out loosely and
  // organically rather than letting it settle into rows.
  function moveToOpenSpot(f: Floater) {
    const b = bounds();
    let best = { x: f.x, y: f.y, score: -Infinity };
    for (let i = 0; i < SPOT_CANDIDATES; i++) {
      f.x = EDGE_INSET_PX + Math.random() * Math.max(0, b.width - f.w - EDGE_INSET_PX * 2);
      f.y = EDGE_INSET_PX + Math.random() * Math.max(0, b.height - f.h - EDGE_INSET_PX * 2);
      const score = Math.min(
        gapBetween(f, b.headline) - HEADLINE_CLEARANCE_PX,
        ...floaters.filter((g) => g !== f).map((g) => gapBetween(f, g) - IMAGE_GAP_PX)
      );
      if (score > best.score) best = { x: f.x, y: f.y, score };
    }
    f.x = best.x;
    f.y = best.y;
  }

  // Pushes overlapping images apart along the line between their centres
  // (and away from the headline), rather than straight up/down/sideways —
  // so the field shifts organically instead of stacking into lines.
  // `pinned` (the newcomer) holds still; its neighbours make room.
  function relax(pinned?: Floater) {
    const b = bounds();
    for (let i = 0; i < RELAX_ITERATIONS; i++) {
      let moved = false;
      for (const f of floaters) {
        if (f === pinned) continue;
        const others: { box: Box; gap: number; share: number }[] = [
          { box: b.headline, gap: 0, share: 1 },
          ...floaters.filter((g) => g !== f).map((g) => ({ box: g, gap: IMAGE_GAP_PX, share: g === pinned ? 1 : 0.5 })),
        ];
        for (const { box, gap, share } of others) {
          const overlap = gap - gapBetween(f, box);
          if (overlap <= 0) continue;
          const c = centre(f);
          const o = centre(box);
          let dx = c.x - o.x;
          let dy = c.y - o.y;
          const len = Math.hypot(dx, dy) || 1;
          dx /= len;
          dy /= len;
          f.x += dx * (overlap + 1) * share;
          f.y += dy * (overlap + 1) * share;
          clampToEdges(f);
          moved = true;
        }
      }
      if (!moved) break;
    }
  }

  // Whether an image touches the headline or any other image.
  function touches(f: Floater) {
    return overlaps(f, bounds().headline, 0) || floaters.some((g) => g !== f && overlaps(f, g, IMAGE_GAP_PX));
  }

  function overlaps(a: Floater, b: { x: number; y: number; w: number; h: number }, gap: number) {
    return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
  }

  function applyPositions(animate: boolean) {
    for (const f of floaters) {
      f.wrap.style.transition = animate ? `left ${JOSTLE_MS}ms ease-in-out, top ${JOSTLE_MS}ms ease-in-out` : '';
      f.wrap.style.left = `${f.x}px`;
      f.wrap.style.top = `${f.y}px`;
    }
  }

  async function createFloater(word: number): Promise<Floater | null> {
    if (!wordImages[word]) {
      wordImages[word] = Array.from({ length: IMAGES_PER_WORD }, () => draw());
      wordNext[word] = 0;
    }
    const image = wordImages[word][wordNext[word]];
    wordNext[word] = (wordNext[word] + 1) % IMAGES_PER_WORD;
    // Warm the word's following image for when this one is replaced.
    preload(wordImages[word][wordNext[word]]);
    const source = preload(image);
    try {
      await source.decode();
    } catch {
      return null; // Failed or still loading on a slow connection — skip it.
    }

    const b = bounds();
    // Varied a little so the field doesn't read as a grid of equal tiles.
    const h = baseHeight * (0.8 + Math.random() * 0.3);
    // Clamped so very tall or panoramic images still read as photos.
    const w = h * Math.min(1.6, Math.max(0.7, image.aspectRatio));
    const x = EDGE_INSET_PX + Math.random() * Math.max(0, b.width - w - EDGE_INSET_PX * 2);
    const y = EDGE_INSET_PX + Math.random() * Math.max(0, b.height - h - EDGE_INSET_PX * 2);

    // Two layers: the outer one drifts (a slow CSS loop with its own random
    // direction and speed) and glides when jostled; the inner card blurs,
    // fades and rises — so none of these fight each other.
    const wrap = document.createElement('div');
    wrap.className = 'hero-float';
    wrap.style.cssText =
      `left:${x}px;top:${y}px;width:${w}px;height:${h}px;` +
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
    return { wrap, card, word, x, y, w, h };
  }

  function fadeIn(floater: Floater, delay = 0) {
    layer.appendChild(floater.wrap);
    floater.card.animate([{ transform: 'scale(0.8)', opacity: 0, filter: 'blur(24px)' }, RESTING], {
      duration: FADE_IN_MS,
      delay,
      easing: 'ease-out',
      fill: 'both',
    });
  }

  // A newcomer lands in an open spot and nudges the images around it
  // outward — the closer they are, the further they move — so the field
  // visibly re-jostles with every arrival, as long as everything ends up
  // clear.
  async function addFloater(word: number, delay = 0) {
    const floater = await createFloater(word);
    if (!floater) return;
    moveToOpenSpot(floater);
    const before = floaters.map((f) => ({ f, x: f.x, y: f.y }));
    floaters.push(floater);

    // Tried at full strength first, then gentler, since a hard shove in a
    // tight layout can bounce images back into each other; only if even the
    // gentlest can't clear do the neighbours stay put.
    const c = centre(floater);
    const reach = Math.hypot(floater.w, floater.h) * JOSTLE_REACH;
    for (const strength of JOSTLE_STRENGTHS) {
      for (const f of floaters) {
        if (f === floater) continue;
        const fc = centre(f);
        const dist = Math.hypot(fc.x - c.x, fc.y - c.y) || 1;
        const push = Math.min(JOSTLE_MAX_PX, Math.max(0, reach - dist) * 0.8) * strength;
        f.x += ((fc.x - c.x) / dist) * push;
        f.y += ((fc.y - c.y) / dist) * push;
        clampToEdges(f);
      }
      relax(floater);
      if (!floaters.some(touches)) break;
      before.forEach(({ f, x, y }) => {
        f.x = x;
        f.y = y;
      });
    }
    // No clear space for it at all on this screen — it sits this round out.
    if (touches(floater)) {
      floaters = floaters.filter((f) => f !== floater);
      return;
    }

    applyPositions(true);
    fadeIn(floater, delay);
    // The newcomer itself appears in place rather than gliding in.
    floater.wrap.style.transition = '';
  }

  function removeFloater(floater: Floater) {
    floaters = floaters.filter((f) => f !== floater);
    floater.wrap.dataset.leaving = '';
    floater.card
      .animate([RESTING, { transform: 'scale(0.85)', opacity: 0, filter: 'blur(24px)' }], {
        duration: FADE_OUT_MS,
        easing: 'ease-in',
        fill: 'forwards',
      })
      .finished.then(() => floater.wrap.remove())
      .catch(() => floater.wrap.remove());
  }

  // One smooth rise and fall: sharpens and grows forward, then sinks straight
  // back into the blur, with no hold or settle in between. Then it makes way
  // for the word's next image.
  function riseAndFall(floater: Floater, delay: number) {
    floater.wrap.style.zIndex = '1';
    floater.card
      .animate(
        [
          { ...RESTING, easing: 'ease-in-out' },
          { transform: `scale(${REVEAL_SCALE})`, opacity: 1, filter: 'blur(0px)', offset: 0.5, easing: 'ease-in-out' },
          RESTING,
        ],
        { duration: REVEAL_MS, delay }
      )
      .finished.then(() => {
        if (!floaters.includes(floater)) return;
        removeFloater(floater);
        addFloater(floater.word, FADE_OUT_MS / 2);
      })
      .catch(() => {});
  }

  function showWord(word: number) {
    currentWord = word;
    if (!heroInView || document.hidden) return;
    floaters
      .filter((f) => f.word === word)
      .forEach((f) => riseAndFall(f, REVEAL_DELAY_MS));
  }

  // Lays the whole field out at once: every word's images, settled into
  // place before any of them is shown, then faded in one after another.
  async function build() {
    floaters.forEach((f) => f.wrap.remove());
    floaters = [];
    measureBaseHeight();
    const created = await Promise.all(
      Array.from({ length: wordCount }, (_, word) => createFloater(word))
    );
    // Each placed in turn in the most open spot left, which spreads them
    // loosely; any that still can't find clear space are left out.
    for (const f of created) {
      if (!f) continue;
      floaters.push(f);
      moveToOpenSpot(f);
      if (touches(f)) floaters = floaters.filter((g) => g !== f);
    }
    applyPositions(false);
    floaters
      .slice()
      .sort(() => Math.random() - 0.5)
      .forEach((f, i) => fadeIn(f, i * 60));
    // The word already on screen gets its rise once the field has faded in,
    // rather than waiting a full cycle for it to come round again.
    window.setTimeout(() => showWord(currentWord), FADE_IN_MS);
  }

  // Pauses reveals while the hero is scrolled away or the tab is hidden; the
  // field itself just keeps drifting.
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

  return { showWord };
}
