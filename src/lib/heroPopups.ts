import type { HeroPopUpImage } from '../types/hero';

/** A loose field of project images floats around the hero headline, blurred
 * and faded back, each drifting on its own slow loop — one per headline word,
 * each word cycling through its own set of three. When a word comes up, its
 * image rises forward — sharpening and growing — and sinks back in one
 * smooth movement; then it dissolves and the word's next image drifts in
 * wherever there's most room, waiting for the word to come round again. The
 * whole field fades away as you scroll. Nothing overlaps the headline or
 * another image. */

// How many images each word cycles through, one on screen at a time.
const IMAGES_PER_WORD = 3;
// The word's image rises just behind the word's own 750ms roll (which
// peaks at ~525ms).
const REVEAL_DELAY_MS = 300;
const REVEAL_MS = 3000;
const FADE_IN_MS = 1200;
const FADE_OUT_MS = 800;
// How far each image wanders from its spot while floating. The spacing
// below allows for two neighbours drifting towards each other at once.
const DRIFT_PX = 6;
const HEADLINE_CLEARANCE_PX = 16 + DRIFT_PX;
const IMAGE_GAP_PX = 8 + DRIFT_PX * 2;
// Kept clear at the screen's edge, just enough that the drift never pushes
// an image off it.
const EDGE_INSET_PX = 12;
// Share of the free space around the headline the field fills — sets the
// image size, so it scales with the number of words and the screen.
const FIELD_COVERAGE = 0.3;
// Random spots tried when picking the most open place for an image.
const SPOT_CANDIDATES = 40;
// How big an image grows as it rises into focus. It sits behind the
// headline, so growing near it never covers the text.
const REVEAL_SCALE = 1.5;
// How far down the page (as a share of the screen's height) the field has
// fully faded away by.
const SCROLL_FADE_END = 0.25;

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

type Box = { x: number; y: number; w: number; h: number };

export function initHeroPopups(layer: HTMLElement, headline: HTMLElement, images: HeroPopUpImage[], wordCount: number) {
  if (images.length < 2 || wordCount < 1) return null;

  let deck: HeroPopUpImage[] = [];
  const preloaded = new Map<string, HTMLImageElement>();
  let floaters: Floater[] = [];
  let heroInView = true;
  let scrolledAway = false;
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
    return deck.pop()!;
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

  // Sized so the whole field (one image per word) fills a set share of the
  // free space around the headline, whatever the screen or word count.
  function measureBaseHeight() {
    const b = bounds();
    const free = Math.max(0, (b.width - EDGE_INSET_PX * 2) * (b.height - EDGE_INSET_PX * 2) - b.headline.w * b.headline.h);
    const perImage = (free * FIELD_COVERAGE) / wordCount;
    // Area = h × (h × ~1.3 average aspect), solved for h.
    const mobile = b.width < 768;
    baseHeight = Math.min(mobile ? 120 : 240, Math.max(mobile ? 64 : 110, Math.sqrt(perImage / 1.3)));
  }

  // Edge-to-edge gap between two boxes (negative when they overlap).
  function gapBetween(a: Box, b: Box) {
    const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    return dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy);
  }

  // The most open of a batch of random spots: the one furthest from the
  // headline and every other image. That naturally pushes images out
  // towards the edges and corners and spreads them loosely, rather than
  // letting them cluster or settle into rows.
  function moveToOpenSpot(f: Floater) {
    const b = bounds();
    let best = { x: f.x, y: f.y, score: -Infinity };
    for (let i = 0; i < SPOT_CANDIDATES; i++) {
      f.x = EDGE_INSET_PX + Math.random() * Math.max(0, b.width - f.w - EDGE_INSET_PX * 2);
      f.y = EDGE_INSET_PX + Math.random() * Math.max(0, b.height - f.h - EDGE_INSET_PX * 2);
      const score = Math.min(
        gapBetween(f, b.headline),
        ...floaters.filter((g) => g !== f).map((g) => gapBetween(f, g) - IMAGE_GAP_PX)
      );
      if (score > best.score) best = { x: f.x, y: f.y, score };
    }
    f.x = best.x;
    f.y = best.y;
    f.wrap.style.left = `${f.x}px`;
    f.wrap.style.top = `${f.y}px`;
    // Clear of the headline and every other image.
    return best.score >= 0;
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
    try {
      await preload(image).decode();
    } catch {
      return null; // Failed or still loading on a slow connection — skip it.
    }

    // Varied a little so the field doesn't read as a grid of equal tiles.
    const h = baseHeight * (0.8 + Math.random() * 0.3);
    // Clamped so very tall or panoramic images still read as photos.
    const w = h * Math.min(1.6, Math.max(0.7, image.aspectRatio));

    // Two layers: the outer one drifts (a slow CSS loop with its own random
    // direction and speed), the inner card blurs, fades and rises — so the
    // two never fight each other.
    const wrap = document.createElement('div');
    wrap.className = 'hero-float';
    wrap.style.cssText =
      `width:${w}px;height:${h}px;` +
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
    return { wrap, card, word, x: 0, y: 0, w, h };
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

  // A newcomer drifts in wherever there's most room; if there's no clear
  // space at all on this screen, it sits this round out.
  async function addFloater(word: number, delay = 0) {
    const floater = await createFloater(word);
    if (!floater) return;
    if (!moveToOpenSpot(floater)) return;
    floaters.push(floater);
    fadeIn(floater, delay);
  }

  function removeFloater(floater: Floater) {
    floaters = floaters.filter((f) => f !== floater);
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
    if (!heroInView || scrolledAway || document.hidden) return;
    floaters.filter((f) => f.word === word).forEach((f) => riseAndFall(f, REVEAL_DELAY_MS));
  }

  // Lays the whole field out at once, each image placed in turn in the most
  // open spot left, then faded in one after another.
  async function build() {
    floaters.forEach((f) => f.wrap.remove());
    floaters = [];
    measureBaseHeight();
    const created = await Promise.all(Array.from({ length: wordCount }, (_, word) => createFloater(word)));
    for (const f of created) {
      if (f && moveToOpenSpot(f)) floaters.push(f);
    }
    floaters
      .slice()
      .sort(() => Math.random() - 0.5)
      .forEach((f, i) => fadeIn(f, i * 60));
    // The word already on screen gets its rise once the field has faded in,
    // rather than waiting a full cycle for it to come round again.
    window.setTimeout(() => showWord(currentWord), FADE_IN_MS);
  }

  // Fades the whole field away over the first stretch of scrolling, so it
  // belongs to the opening screen only; reveals pause once it's gone.
  function updateScrollFade() {
    const progress = Math.min(1, Math.max(0, window.scrollY / (window.innerHeight * SCROLL_FADE_END)));
    layer.style.opacity = String(1 - progress);
    scrolledAway = progress >= 1;
  }
  let scrollRafId = 0;
  window.addEventListener(
    'scroll',
    () => {
      if (scrollRafId) return;
      scrollRafId = requestAnimationFrame(() => {
        scrollRafId = 0;
        updateScrollFade();
      });
    },
    { passive: true }
  );
  updateScrollFade();

  // Pauses reveals while the hero is off screen or the tab is hidden.
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
