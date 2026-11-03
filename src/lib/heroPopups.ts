import type { HeroPopUpImage } from '../types/hero';

/** A loose field of project images floats around the hero headline, blurred
 * and faded back, each drifting on its own slow loop — one per headline word,
 * each word cycling through its own set of three. When a word comes up, its
 * image rises forward — sharpening and growing — and sinks back in one
 * smooth movement; then it dissolves and the word's next image drifts in
 * wherever there's most room, waiting for the word to come round again. As
 * you scroll, the hero's stage sends the whole field zooming past (zoomPast). On desktop, hovering an image brings
 * it up and holds it there — it can be clicked and dragged about — and once
 * the cursor leaves it falls away and its word's next image takes its
 * place. Nothing overlaps the headline or
 * another image. */

// How many images each word cycles through, one on screen at a time.
const IMAGES_PER_WORD = 3;
// The word's image rises just behind the word's own 750ms roll (which
// peaks at ~525ms).
const REVEAL_DELAY_MS = 300;
const REVEAL_MS = 3000;
const FADE_IN_MS = 1200;
// How far each image wanders from its spot while floating. The spacing
// below allows for two neighbours drifting towards each other at once.
const DRIFT_PX = 6;
const HEADLINE_CLEARANCE_PX = 16 + DRIFT_PX;
const IMAGE_GAP_PX = 8 + DRIFT_PX * 2;
// Kept clear at the screen's edge, just enough that the drift never pushes
// an image off it.
const EDGE_INSET_PX = 12;
// More room kept at the bottom, so the field sits clear of the tagline and
// the showreel peeking in below it.
const BOTTOM_INSET_PX = 72;
// Share of the free space around the headline the field fills — sets the
// image size, so it scales with the number of words and the screen.
const FIELD_COVERAGE = 0.3;
// Most floating images a phone-sized screen holds at once.
const MOBILE_MAX_ON_SCREEN = 4;
// Random spots tried when placing an image, and how many of the best it
// picks between at random.
const SPOT_CANDIDATES = 60;
const PICK_FROM_BEST = 4;
// Past this much clear space, a spot doesn't count as any better.
const COMFORTABLE_GAP_PX = 80;
// Two images count as lined up when their centres are within this share
// of their combined height (or width) of each other, and each such
// neighbour costs a spot this many points.
const ALIGN_TOLERANCE = 0.18;
const ALIGN_PENALTY = 80;
// How big an image grows as it rises into focus.
const REVEAL_SCALE = 1.5;
const REVEALED: Keyframe = { transform: `scale(${REVEAL_SCALE})`, opacity: 1, filter: 'blur(0px)' };
// Hover: how quickly an image comes up (overshooting and settling), and how
// long it takes to fall away once the cursor leaves.
const HOLD_RISE_MS = 900;
const RELEASE_FALL_MS = 1500;
// Each image gets a depth (0 nearest, 1 furthest back) that sets how blurred
// and faint it rests, and how hard it zooms past when the hero's scroll
// stage sends the field flying (see zoomPast) — nearer ones rush past
// faster, so blur and movement tell the same story about depth.
//
// Resting look, from nearest to furthest back.
const RESTING_NEAR = { blur: 8, opacity: 0.55 };
const RESTING_FAR = { blur: 20, opacity: 0.35 };
// As the stage zooms the field past: how far each image flies outward
// (as a multiple of its distance from the screen's centre), how much it
// grows, and how much the field blurs.
// Kept well below the headline's own travel (see the hero's stage script):
// the field moving slower than the title is what sets it behind.
const ZOOM_TRAVEL = { near: 0.9, far: 0.4 };
const ZOOM_SCALE = { near: 1.6, far: 1.25 };
const ZOOM_BLUR_PX = 16;
const GONE: Keyframe = { transform: 'scale(0.85)', opacity: 0, filter: 'blur(24px)' };

interface Floater {
  wrap: HTMLElement;
  card: HTMLElement;
  word: number;
  depth: number;
  // resting: blurred in the field. revealing: mid word-reveal (rise then
  // fall in one go). held: brought up by hover and staying up. falling: on
  // its way out after a hover.
  state: 'resting' | 'revealing' | 'held' | 'falling';
  // The rise/fall currently playing on the card, if any.
  anim: Animation | null;
  dragging: boolean;
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
  let paused = false;
  let zoom = 0;
  let baseHeight = 0;
  // Each word's own set of images, and which one it shows next.
  const wordImages: HeroPopUpImage[][] = [];
  const wordNext: number[] = [];

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
  // Phones get a sparser field — a few images rather than one per word —
  // so the small screen doesn't fill up. Words without one waiting still
  // get an image placed when they come up (see showWord).
  function maxOnScreen() {
    return layer.getBoundingClientRect().width < 768 ? Math.min(MOBILE_MAX_ON_SCREEN, wordCount) : wordCount;
  }

  function measureBaseHeight() {
    const b = bounds();
    const free = Math.max(0, (b.width - EDGE_INSET_PX * 2) * (b.height - EDGE_INSET_PX - BOTTOM_INSET_PX) - b.headline.w * b.headline.h);
    const perImage = (free * FIELD_COVERAGE) / maxOnScreen();
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

  // Picks from a batch of random spots. A spot must be clear of the
  // headline and every other image; beyond that, it scores for space up to
  // a comfortable gap (past which more distance counts for nothing, so
  // images aren't all pulled out to the edges) and loses points for sitting
  // level with, or directly above or below, another image — which is what
  // made the field fall into rows. The pick is random among the best few,
  // so the layout stays loose rather than predictable.
  function moveToOpenSpot(f: Floater) {
    const b = bounds();
    const others = floaters.filter((g) => g !== f);
    const candidates: { x: number; y: number; clear: boolean; score: number }[] = [];
    for (let i = 0; i < SPOT_CANDIDATES; i++) {
      f.x = EDGE_INSET_PX + Math.random() * Math.max(0, b.width - f.w - EDGE_INSET_PX * 2);
      f.y = EDGE_INSET_PX + Math.random() * Math.max(0, b.height - f.h - EDGE_INSET_PX - BOTTOM_INSET_PX);
      const gap = Math.min(gapBetween(f, b.headline), ...others.map((g) => gapBetween(f, g) - IMAGE_GAP_PX));
      const cx = f.x + f.w / 2;
      const cy = f.y + f.h / 2;
      const aligned = others.filter((g) => {
        const gx = g.x + g.w / 2;
        const gy = g.y + g.h / 2;
        return Math.abs(cy - gy) < (f.h + g.h) * ALIGN_TOLERANCE || Math.abs(cx - gx) < (f.w + g.w) * ALIGN_TOLERANCE;
      }).length;
      candidates.push({
        x: f.x,
        y: f.y,
        clear: gap >= 0,
        score: Math.min(gap, COMFORTABLE_GAP_PX) - aligned * ALIGN_PENALTY,
      });
    }
    const clear = candidates.filter((c) => c.clear).sort((a, c) => c.score - a.score);
    const pick = clear.length
      ? clear[Math.floor(Math.random() * Math.min(PICK_FROM_BEST, clear.length))]
      : candidates.reduce((a, c) => (c.score > a.score ? c : a));
    f.x = pick.x;
    f.y = pick.y;
    f.wrap.style.left = `${f.x}px`;
    f.wrap.style.top = `${f.y}px`;
    return clear.length > 0;
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
    const h = baseHeight * (0.65 + Math.random() * 0.5);
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
    img.draggable = false;
    card.appendChild(img);
    wrap.appendChild(card);
    const depth = Math.random();
    const floater: Floater = { wrap, card, word, depth, state: 'resting', anim: null, dragging: false, x: 0, y: 0, w, h };
    // Hovering brings an image up and holds it there until the cursor
    // leaves; it can be clicked and dragged about while it's up. Desktop
    // only — on touch there's nothing to hover, and a tap shouldn't be
    // swallowed by a decorative image.
    if (canHover) {
      wrap.style.pointerEvents = 'auto';
      wrap.addEventListener('pointerenter', () => hold(floater));
      wrap.addEventListener('pointerleave', () => release(floater));
      wrap.addEventListener('pointerdown', (e) => startDrag(floater, e));
    }
    return floater;
  }

  function resting(f: Floater): Keyframe {
    const far = f.depth;
    const blur = RESTING_NEAR.blur + (RESTING_FAR.blur - RESTING_NEAR.blur) * far;
    const opacity = RESTING_NEAR.opacity + (RESTING_FAR.opacity - RESTING_NEAR.opacity) * far;
    return { transform: 'scale(0.92)', opacity, filter: `blur(${blur}px)` };
  }

  function fadeIn(floater: Floater, delay = 0) {
    layer.appendChild(floater.wrap);
    // Joins in mid-zoom if the stage is already under way.
    applyZoom(floater, layer.getBoundingClientRect());
    floater.card.animate([{ transform: 'scale(0.8)', opacity: 0, filter: 'blur(24px)' }, resting(floater)], {
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
    if (!floater || !moveToOpenSpot(floater)) return null;
    floaters.push(floater);
    fadeIn(floater, delay);
    return floater;
  }

  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Where the card is right now, mid-animation or not — every move below
  // starts from here, so catching an image partway through anything carries
  // on smoothly rather than jumping.
  function currentFrame(f: Floater): Keyframe {
    const now = getComputedStyle(f.card);
    return { transform: now.transform, opacity: now.opacity, filter: now.filter };
  }

  function play(f: Floater, keyframes: Keyframe[], options: KeyframeAnimationOptions, onDone?: () => void) {
    const previous = f.anim;
    const anim = f.card.animate(keyframes, { ...options, fill: 'both' });
    // Cancelled only once the new one has taken over, so there's no frame
    // where neither holds the card.
    previous?.cancel();
    f.anim = anim;
    anim.finished
      .then(() => {
        if (f.anim === anim) onDone?.();
      })
      .catch(() => {});
  }

  // Gone for good: makes way for the word's next image — unless the word
  // already has one waiting (placed when it came up while this one was
  // still on its way out), or the screen already holds as many as it
  // should (phones keep a sparser field).
  function retire(f: Floater) {
    if (!floaters.includes(f)) return;
    floaters = floaters.filter((g) => g !== f);
    f.wrap.remove();
    if (!floaters.some((g) => g.word === f.word) && floaters.length < maxOnScreen()) addFloater(f.word);
  }

  // A word reveal: one smooth movement up out of the blur, sharpening and
  // growing, then straight on falling away — shrinking, blurring and fading
  // until it's gone — with no hold in between.
  function wordReveal(f: Floater, delay: number) {
    f.state = 'revealing';
    f.wrap.style.zIndex = '1';
    play(
      f,
      [{ ...currentFrame(f), easing: 'ease-in-out' }, { ...REVEALED, offset: 0.5, easing: 'ease-in' }, GONE],
      { duration: REVEAL_MS, delay },
      () => retire(f)
    );
  }

  // Hover: up into focus, overshooting slightly past full size and settling
  // back (the site's usual overshoot-and-settle), then resting there until
  // the cursor leaves. Also catches an image mid
  // word reveal, or mid fall after an earlier hover, and brings it back up.
  function hold(f: Floater) {
    if (!floaters.includes(f) || f.state === 'held') return;
    f.state = 'held';
    f.wrap.style.zIndex = '2';
    play(
      f,
      [
        currentFrame(f),
        { ...REVEALED, transform: `scale(${REVEAL_SCALE * 1.05})`, offset: 0.6 },
        { ...REVEALED, transform: `scale(${REVEAL_SCALE * 0.985})`, offset: 0.85 },
        REVEALED,
      ],
      { duration: HOLD_RISE_MS, easing: 'ease-out' }
    );
  }

  // Mouse off (and not mid-drag): falls away from wherever it is, and the
  // word's next image takes its place.
  function release(f: Floater) {
    if (f.state !== 'held' || f.dragging) return;
    f.state = 'falling';
    f.wrap.style.zIndex = '1';
    play(f, [currentFrame(f), GONE], { duration: RELEASE_FALL_MS, easing: 'ease-in' }, () => retire(f));
  }

  // Click and drag a held image anywhere in the hero. Pointer capture keeps
  // the drag going even if the cursor outruns the image. Letting go of the
  // click lets go of the image: it falls away from where it was dropped.
  function startDrag(f: Floater, e: PointerEvent) {
    if (e.button !== 0 || !floaters.includes(f)) return;
    e.preventDefault();
    hold(f);
    f.dragging = true;
    f.wrap.classList.add('is-dragging');
    f.wrap.setPointerCapture(e.pointerId);
    const start = { x: e.clientX, y: e.clientY, left: f.x, top: f.y };
    const b = bounds();

    const move = (ev: PointerEvent) => {
      f.x = Math.min(Math.max(start.left + ev.clientX - start.x, -f.w / 2), b.width - f.w / 2);
      f.y = Math.min(Math.max(start.top + ev.clientY - start.y, -f.h / 2), b.height - f.h / 2);
      f.wrap.style.left = `${f.x}px`;
      f.wrap.style.top = `${f.y}px`;
    };
    const end = (ev: PointerEvent) => {
      f.dragging = false;
      f.wrap.classList.remove('is-dragging');
      f.wrap.removeEventListener('pointermove', move);
      f.wrap.removeEventListener('pointerup', end);
      f.wrap.removeEventListener('pointercancel', end);
      if (f.wrap.hasPointerCapture(ev.pointerId)) f.wrap.releasePointerCapture(ev.pointerId);
      release(f);
    };
    f.wrap.addEventListener('pointermove', move);
    f.wrap.addEventListener('pointerup', end);
    f.wrap.addEventListener('pointercancel', end);
  }

  // Each word change brings that word's image up. If it's already up
  // (held under the cursor), it's left be. If the word has no image waiting
  // (a hover already sent it on its way, or there was no clear space for it
  // last time), one is placed now and rises straight away, so a word change
  // never goes without one.
  async function showWord(word: number) {
    if (!heroInView || paused || document.hidden) return;
    const mine = floaters.filter((f) => f.word === word);
    const waiting = mine.find((f) => f.state === 'resting');
    if (waiting) {
      wordReveal(waiting, REVEAL_DELAY_MS);
      return;
    }
    if (mine.some((f) => f.state === 'held')) return;
    const placed = await addFloater(word);
    if (placed) wordReveal(placed, REVEAL_DELAY_MS);
  }

  // Lays the whole field out at once, each image placed in turn in the most
  // open spot left, then faded in one after another.
  async function build() {
    floaters.forEach((f) => f.wrap.remove());
    floaters = [];
    measureBaseHeight();
    // One per word, or on phones a random handful of the words.
    const words = Array.from({ length: wordCount }, (_, word) => word)
      .sort(() => Math.random() - 0.5)
      .slice(0, maxOnScreen());
    const created = await Promise.all(words.map((word) => createFloater(word)));
    for (const f of created) {
      if (f && moveToOpenSpot(f)) floaters.push(f);
    }
    floaters
      .slice()
      .sort(() => Math.random() - 0.5)
      .forEach((f, i) => fadeIn(f, i * 60));
  }

  // The hero's scroll stage sends the field flying past the viewer: at
  // amount 0 everything sits where it floats; towards 1 each image flies
  // outward from the screen's centre, growing (nearer ones further and
  // bigger), while the whole field blurs and fades. Uses the standalone
  // translate/scale properties, so it stacks with the drift loop's
  // transform on the same element instead of replacing it.
  function applyZoom(f: Floater, layerRect: DOMRect) {
    if (!zoom) {
      f.wrap.style.translate = '';
      f.wrap.style.scale = '';
      return;
    }
    const dx = layerRect.left + f.x + f.w / 2 - window.innerWidth / 2;
    const dy = layerRect.top + f.y + f.h / 2 - window.innerHeight / 2;
    const travel = ZOOM_TRAVEL.near + (ZOOM_TRAVEL.far - ZOOM_TRAVEL.near) * f.depth;
    const grow = ZOOM_SCALE.near + (ZOOM_SCALE.far - ZOOM_SCALE.near) * f.depth;
    f.wrap.style.translate = `${dx * zoom * travel}px ${dy * zoom * travel}px`;
    f.wrap.style.scale = String(1 + zoom * (grow - 1));
  }

  function zoomPast(amount: number) {
    zoom = amount;
    const layerRect = layer.getBoundingClientRect();
    floaters.forEach((f) => applyZoom(f, layerRect));
    layer.style.opacity = amount ? String(1 - amount) : '';
    layer.style.filter = amount ? `blur(${amount * ZOOM_BLUR_PX}px)` : '';
  }

  // Word reveals hold off while the stage is under way.
  function setPaused(value: boolean) {
    paused = value;
  }

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

  return { showWord, zoomPast, setPaused };
}
