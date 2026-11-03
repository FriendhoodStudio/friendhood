import type { HeroPopUpImage } from '../types/hero';

/** A loose field of project images floats around the hero headline, blurred
 * and faded back, each drifting on its own slow loop. Every headline word owns
 * three of them. When a word comes up, its three rise forward — sharpening and
 * growing slightly — and sink back in one smooth movement; then they dissolve
 * and three new images for that word drift in, waiting for the word to come
 * round again. Each newcomer lands in a random spot and its neighbours glide
 * aside to make room, so the field gently re-jostles. Images come from a
 * shuffled deck (every image shows once before any repeats), and nothing
 * overlaps the headline or another image. */

const IMAGES_PER_WORD = 3;
// A word's three images rise one after another, starting just behind the
// word's own 750ms roll (which peaks at ~525ms).
const REVEAL_DELAY_MS = 300;
const REVEAL_STAGGER_MS = 180;
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
const FIELD_COVERAGE = 0.26;
const RELAX_ITERATIONS = 150;

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
    // Warm the next few so they've decoded by the time they're needed.
    deck.slice(-IMAGES_PER_WORD).forEach((image) => preload(image));
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
    const perImage = (free * FIELD_COVERAGE) / (wordCount * IMAGES_PER_WORD);
    // Area = h × (h × ~1.3 average aspect), solved for h.
    const mobile = b.width < 768;
    baseHeight = Math.min(mobile ? 110 : 190, Math.max(mobile ? 44 : 70, Math.sqrt(perImage / 1.3)));
  }

  // Push apart anything overlapping (another image or the headline) and keep
  // everything inside the edge inset — a few rounds of nudging each overlap
  // half each way along whichever axis needs the smaller move. `pinned`
  // (the newcomer) only moves for the headline, so neighbours make room
  // around it rather than shoving it back out.
  function relax(pinned?: Floater) {
    const b = bounds();
    const clamp = (f: Floater) => {
      f.x = Math.min(Math.max(f.x, EDGE_INSET_PX), b.width - f.w - EDGE_INSET_PX);
      f.y = Math.min(Math.max(f.y, EDGE_INSET_PX), b.height - f.h - EDGE_INSET_PX);
    };
    const separate = (a: Floater, other: { x: number; y: number; w: number; h: number }, gap: number, share: number) => {
      const overlapX = Math.min(a.x + a.w, other.x + other.w) - Math.max(a.x, other.x) + gap;
      const overlapY = Math.min(a.y + a.h, other.y + other.h) - Math.max(a.y, other.y) + gap;
      if (overlapX <= 0 || overlapY <= 0) return 0;
      const dirX = a.x + a.w / 2 < other.x + other.w / 2 ? -1 : 1;
      const dirY = a.y + a.h / 2 < other.y + other.h / 2 ? -1 : 1;
      if (overlapX < overlapY) a.x += dirX * overlapX * share;
      else a.y += dirY * overlapY * share;
      return 1;
    };

    for (let i = 0; i < RELAX_ITERATIONS; i++) {
      let moved = 0;
      for (const f of floaters) {
        moved += separate(f, b.headline, 0, 1);
        for (const g of floaters) {
          if (f === g || f === pinned) continue;
          moved += separate(f, g, IMAGE_GAP_PX, g === pinned ? 1 : 0.5);
        }
        clamp(f);
      }
      if (moved === 0) break;
    }
  }

  // Whether an image touches the headline or any other image.
  function touches(f: Floater) {
    return overlaps(f, bounds().headline, 0) || floaters.some((g) => g !== f && overlaps(f, g, IMAGE_GAP_PX));
  }

  // Tries random spots for an image until one is clear. False if none is.
  function relocate(f: Floater) {
    const b = bounds();
    for (let i = 0; i < 80; i++) {
      f.x = EDGE_INSET_PX + Math.random() * Math.max(0, b.width - f.w - EDGE_INSET_PX * 2);
      f.y = EDGE_INSET_PX + Math.random() * Math.max(0, b.height - f.h - EDGE_INSET_PX * 2);
      if (!touches(f)) return true;
    }
    return false;
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
    const image = draw();
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

  // A newcomer lands in its random spot and its neighbours glide aside —
  // kept only if that leaves everything clear (in a crowded field, nudging
  // can bounce images off the edges back into each other). Otherwise the
  // jostle is undone and the newcomer takes the space the image it replaces
  // just left, which is known to be free; failing that, any clear spot.
  async function addFloater(word: number, vacated: Floater, delay = 0) {
    const floater = await createFloater(word);
    if (!floater) return;
    const before = floaters.map((f) => ({ f, x: f.x, y: f.y }));
    floaters.push(floater);
    relax(floater);

    if (floaters.some(touches)) {
      before.forEach(({ f, x, y }) => {
        f.x = x;
        f.y = y;
      });
      Object.assign(floater, { x: vacated.x, y: vacated.y, w: vacated.w, h: vacated.h });
      floater.wrap.style.width = `${vacated.w}px`;
      floater.wrap.style.height = `${vacated.h}px`;
      if (touches(floater) && !relocate(floater)) {
        floaters = floaters.filter((f) => f !== floater);
        return;
      }
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
          { transform: 'scale(1.06)', opacity: 1, filter: 'blur(0px)', offset: 0.5, easing: 'ease-in-out' },
          RESTING,
        ],
        { duration: REVEAL_MS, delay }
      )
      .finished.then(() => {
        if (!floaters.includes(floater)) return;
        removeFloater(floater);
        addFloater(floater.word, floater, FADE_OUT_MS / 2);
      })
      .catch(() => {});
  }

  function showWord(word: number) {
    currentWord = word;
    if (!heroInView || document.hidden) return;
    floaters
      .filter((f) => f.word === word)
      .forEach((f, i) => riseAndFall(f, REVEAL_DELAY_MS + i * REVEAL_STAGGER_MS));
  }

  // Lays the whole field out at once: every word's images, settled into
  // place before any of them is shown, then faded in one after another.
  async function build() {
    floaters.forEach((f) => f.wrap.remove());
    floaters = [];
    measureBaseHeight();
    const created = await Promise.all(
      Array.from({ length: wordCount * IMAGES_PER_WORD }, (_, i) => createFloater(i % wordCount))
    );
    floaters = created.filter((f): f is Floater => f !== null);
    relax();
    // Anything the nudging couldn't clear gets a clear random spot, or —
    // if there's genuinely no room on this screen — is left out.
    for (const f of floaters.slice()) {
      if (touches(f) && !relocate(f)) floaters = floaters.filter((g) => g !== f);
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
