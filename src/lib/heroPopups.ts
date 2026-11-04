import type { HeroPopUpImage } from '../types/hero';

/** A loose field of project images floats around the hero headline, blurred
 * and faded back, each drifting on its own slow loop — one per headline word,
 * each word cycling through its own set of three. When a word comes up, its
 * image rises forward — sharpening and growing — and sinks back in one
 * smooth movement; then it dissolves and the word's next image drifts in
 * wherever there's most room, waiting for the word to come round again. As
 * you scroll, the hero's stage sends the whole field zooming past (zoomPast). Hovering an image (or pressing and
 * holding it on a touch screen) brings it up and holds it there — it can be
 * dragged about — and once let go it falls away and its word's next image
 * takes its place. Nothing overlaps the headline or
 * another image. */

// How many images each word cycles through, one on screen at a time.
const IMAGES_PER_WORD = 3;
// The word's image rises just behind the word's own 750ms roll (which
// peaks at ~525ms).
const REVEAL_DELAY_MS = 300;
const REVEAL_MS = 3000;
const FADE_IN_MS = 700;
// Gap between the field's images fading in, one after another.
const FADE_IN_STAGGER_MS = 90;
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
const REVEALED: Pose = { transform: `scale(${REVEAL_SCALE})`, opacity: 1, focus: 1 };
// Hover: how quickly an image comes up (overshooting and settling), and how
// long it takes to fall away once the cursor leaves.
const HOLD_RISE_MS = 750;
const RELEASE_FALL_MS = 1200;
// Touch: how long a finger has to rest on an image to pick it up (it starts
// rising as soon as it's touched), and how far it can wander meanwhile
// before it counts as a scroll instead.
const HOLD_TO_DRAG_MS = 150;
const HOLD_SLOP_PX = 10;
// Each image gets a depth (0 nearest, 1 furthest back) that sets how blurred
// and faint it rests, and how hard it zooms past when the hero's scroll
// stage sends the field flying (see zoomPast) — nearer ones rush past
// faster, so blur and movement tell the same story about depth.
//
// Resting look, from nearest to furthest back. The blur is baked into a
// small copy of the image by Sanity's image service (blur strength in its
// own units, on a copy SOFT_WIDTH_PX wide inside SOFT_PAD_PX of transparent
// padding the blur feathers out into — transparent page colour, as
// transparent black blurred a dark rim into the edges), rather than applied
// live with CSS:
// Chrome redraws every live blur on every frame, which with a field of
// drifting images ate so much of the GPU that, mid trackpad scroll, it held
// back the scroll stage's frames entirely. Coming into focus crossfades
// from the soft copy to the sharp image.
const RESTING_NEAR = { blur: 45, opacity: 0.55 };
const RESTING_FAR = { blur: 100, opacity: 0.35 };
const SOFT_WIDTH_PX = 160;
const SOFT_PAD_PX = 24;
// As the stage zooms the field past: how far each image flies outward
// (as a multiple of its distance from the screen's centre), how much it
// grows.
// Kept well below the headline's own travel (see the hero's stage script):
// the field moving slower than the title is what sets it behind.
const ZOOM_TRAVEL = { near: 0.9, far: 0.4 };
const ZOOM_SCALE = { near: 1.6, far: 1.25 };
const GONE: Pose = { transform: 'scale(0.85)', opacity: 0, focus: 0 };
// Let go after a hover, an image goes soft first: it's fully back to its
// blurred copy this far into the fall, while it's still clearly visible,
// and only then fades out. (A word reveal's fall blurs and fades together.)
const SOFT_BY = 0.45;

// A card's look at a moment: its transform and opacity, plus how far the
// sharp image has faded in over the soft one (0 resting, 1 in focus).
interface Pose {
  transform: string;
  opacity: number | string;
  focus: number | string;
  offset?: number;
  easing?: string;
}

interface Floater {
  wrap: HTMLElement;
  card: HTMLElement;
  soft: HTMLImageElement;
  sharp: HTMLImageElement;
  word: number;
  depth: number;
  // resting: blurred in the field. revealing: mid word-reveal (rise then
  // fall in one go). held: brought up by hover and staying up. falling: on
  // its way out after a hover.
  state: 'resting' | 'revealing' | 'held' | 'falling';
  // The rise/fall currently playing on the card, if any, and the matching
  // crossfade between its soft and sharp images.
  anim: Animation | null;
  focusAnims: Animation[];
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

  // Each image keeps one depth, and its soft copy's blur is rounded to a
  // few set strengths, so the soft copies' URLs repeat from visit to visit
  // and Sanity's CDN serves them ready-made instead of making a fresh one
  // (which is slow) every time.
  const depths = new Map<string, number>();
  function depthFor(image: HeroPopUpImage) {
    if (!depths.has(image.url)) depths.set(image.url, Math.round(Math.random() * 3) / 3);
    return depths.get(image.url)!;
  }
  function softUrl(image: HeroPopUpImage, depth: number) {
    const softH = Math.round(SOFT_WIDTH_PX / Math.min(1.6, Math.max(0.7, image.aspectRatio)));
    const blur = Math.round(RESTING_NEAR.blur + (RESTING_FAR.blur - RESTING_NEAR.blur) * depth);
    return (
      `${image.url.split('?')[0]}?w=${SOFT_WIDTH_PX + SOFT_PAD_PX * 2}&h=${softH + SOFT_PAD_PX * 2}` +
      `&fit=crop&pad=${SOFT_PAD_PX}&bg=00F9F7F2&blur=${blur}&fm=webp&q=70`
    );
  }
  const softPreloaded = new Map<string, HTMLImageElement>();
  function preloadSoft(image: HeroPopUpImage) {
    const url = softUrl(image, depthFor(image));
    if (!softPreloaded.has(url)) {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      softPreloaded.set(url, img);
    }
    return softPreloaded.get(url)!;
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
    // Varied a little so the field doesn't read as a grid of equal tiles.
    const h = baseHeight * (0.65 + Math.random() * 0.5);
    // Clamped so very tall or panoramic images still read as photos.
    const w = h * Math.min(1.6, Math.max(0.7, image.aspectRatio));
    const depth = depthFor(image);

    // The soft copy, cropped to the card's shape and blurred to its depth.
    const softH = Math.round((SOFT_WIDTH_PX * h) / w);
    const soft = new Image();
    soft.decoding = 'async';
    soft.src = softUrl(image, depth);
    try {
      await Promise.all([preload(image).decode(), soft.decode()]);
    } catch {
      return null; // Failed or still loading on a slow connection — skip it.
    }

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
      `--drift-duration:${8 + Math.random() * 5}s;animation-delay:${-Math.random() * 13}s`;
    const card = document.createElement('div');
    card.className = 'hero-popup';
    // Scaled up from its small size, padding and all, so the image part
    // lines up with the card and the blur spills softly past its edges.
    const scale = w / SOFT_WIDTH_PX;
    soft.className = 'hero-popup-soft';
    soft.alt = '';
    soft.draggable = false;
    soft.style.cssText =
      `left:${-SOFT_PAD_PX * scale}px;top:${-SOFT_PAD_PX * scale}px;` +
      `width:${(SOFT_WIDTH_PX + SOFT_PAD_PX * 2) * scale}px;height:${(softH + SOFT_PAD_PX * 2) * scale}px`;
    const sharp = document.createElement('img');
    sharp.className = 'hero-popup-sharp';
    sharp.src = image.url;
    sharp.alt = '';
    sharp.draggable = false;
    card.append(soft, sharp);
    wrap.appendChild(card);
    const floater: Floater = { wrap, card, soft, sharp, word, depth, state: 'resting', anim: null, focusAnims: [], dragging: false, x: 0, y: 0, w, h };
    // Hovering brings an image up and holds it there until the cursor
    // leaves; it can be clicked and dragged about while it's up. On touch,
    // pressing and holding a finger on one does the same (see watchTouch).
    // The mouse handlers ignore touch, which a hybrid laptop sends both of.
    wrap.style.pointerEvents = 'auto';
    wrap.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && hold(floater));
    wrap.addEventListener('pointerleave', (e) => e.pointerType !== 'touch' && release(floater));
    wrap.addEventListener('pointerdown', (e) => startDrag(floater, e));
    wrap.addEventListener('touchstart', (e) => watchTouch(floater, e), { passive: true });
    // Safari decides whether a touch can be stopped from scrolling from the
    // listeners already on the spot when the finger lands, so this one has
    // to be here from the start, not added once a hold begins.
    wrap.addEventListener('touchmove', (e) => floater.dragging && e.preventDefault(), { passive: false });
    // Android opens the image menu on a long press, right as a drag starts.
    wrap.addEventListener('contextmenu', (e) => floater.dragging && e.preventDefault());
    return floater;
  }

  function resting(f: Floater): Pose {
    const opacity = RESTING_NEAR.opacity + (RESTING_FAR.opacity - RESTING_NEAR.opacity) * f.depth;
    return { transform: 'scale(0.92)', opacity, focus: 0 };
  }

  function fadeIn(floater: Floater, delay = 0) {
    layer.appendChild(floater.wrap);
    // Joins in mid-zoom if the stage is already under way.
    applyZoom(floater, layer.getBoundingClientRect());
    play(floater, [{ transform: 'scale(0.8)', opacity: 0, focus: 0 }, resting(floater)], {
      duration: FADE_IN_MS,
      delay,
      easing: 'ease-out',
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

  // Where the card is right now, mid-animation or not — every move below
  // starts from here, so catching an image partway through anything carries
  // on smoothly rather than jumping.
  function currentFrame(f: Floater): Pose {
    const now = getComputedStyle(f.card);
    return { transform: now.transform, opacity: now.opacity, focus: getComputedStyle(f.sharp).opacity };
  }

  // Plays a run of poses: the card's transform and opacity, and alongside
  // it the crossfade from soft to sharp — the soft copy fades out as the
  // sharp image fades in, or its blur would spill out round the sharp
  // image's edges like a shadow.
  // `focus` optionally gives the sharp/soft crossfade its own keyframes
  // (offsets across the whole animation), so it can run ahead of the move.
  function play(
    f: Floater,
    poses: Pose[],
    options: KeyframeAnimationOptions,
    onDone?: () => void,
    focus?: { focus: number | string; offset?: number; easing?: string }[]
  ) {
    const previous = [f.anim, ...f.focusAnims];
    const timing = (p: Pose) => ({ ...(p.offset !== undefined && { offset: p.offset }), ...(p.easing && { easing: p.easing }) });
    const anim = f.card.animate(
      poses.map((p) => ({ transform: p.transform, opacity: p.opacity, ...timing(p) })),
      { ...options, fill: 'both' }
    );
    const focusFrames = focus ?? poses;
    // The crossfade's easing lives on its keyframes, not the whole run.
    const focusOptions = focus ? { ...options, easing: 'linear' } : options;
    f.focusAnims = [
      f.sharp.animate(focusFrames.map((p) => ({ opacity: p.focus, ...timing(p as Pose) })), { ...focusOptions, fill: 'both' }),
      f.soft.animate(focusFrames.map((p) => ({ opacity: 1 - Number(p.focus), ...timing(p as Pose) })), { ...focusOptions, fill: 'both' }),
    ];
    // Cancelled only once the new ones have taken over, so there's no frame
    // where neither holds the card.
    previous.forEach((a) => a?.cancel());
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
    play(f, [currentFrame(f), GONE], { duration: RELEASE_FALL_MS, easing: 'ease-in' }, () => retire(f), [
      { focus: currentFrame(f).focus, easing: 'ease-in-out' },
      { focus: 0, offset: SOFT_BY },
      { focus: 0 },
    ]);
  }

  // Picks a held image up to be dragged anywhere in the hero from (x, y).
  // Letting go lets go of the image: it falls away from where it was dropped.
  function beginDrag(f: Floater, x: number, y: number) {
    hold(f);
    f.dragging = true;
    f.wrap.classList.add('is-dragging');
    const start = { x, y, left: f.x, top: f.y };
    const b = bounds();
    return {
      move(cx: number, cy: number) {
        f.x = Math.min(Math.max(start.left + cx - start.x, -f.w / 2), b.width - f.w / 2);
        f.y = Math.min(Math.max(start.top + cy - start.y, -f.h / 2), b.height - f.h / 2);
        f.wrap.style.left = `${f.x}px`;
        f.wrap.style.top = `${f.y}px`;
      },
      end() {
        f.dragging = false;
        f.wrap.classList.remove('is-dragging');
        release(f);
      },
    };
  }

  // Mouse: click and drag. Pointer capture keeps the drag going even if the
  // cursor outruns the image.
  function startDrag(f: Floater, e: PointerEvent) {
    if (e.pointerType === 'touch' || e.button !== 0 || !floaters.includes(f)) return;
    e.preventDefault();
    const drag = beginDrag(f, e.clientX, e.clientY);
    f.wrap.setPointerCapture(e.pointerId);

    const move = (ev: PointerEvent) => drag.move(ev.clientX, ev.clientY);
    const end = (ev: PointerEvent) => {
      f.wrap.removeEventListener('pointermove', move);
      f.wrap.removeEventListener('pointerup', end);
      f.wrap.removeEventListener('pointercancel', end);
      if (f.wrap.hasPointerCapture(ev.pointerId)) f.wrap.releasePointerCapture(ev.pointerId);
      drag.end();
    };
    f.wrap.addEventListener('pointermove', move);
    f.wrap.addEventListener('pointerup', end);
    f.wrap.addEventListener('pointercancel', end);
  }

  // Touch: the image starts rising the moment it's touched, so there's
  // something to see straight away; holding still a moment longer picks it
  // up to drag about. A finger that moves off before then is a scroll or
  // swipe, left to the page, and the image drops back, as does a tap. Once the image is up, the touchmove listener set up
  // with the image stops the page scrolling under the drag (the browser
  // only lets that happen before it has started scrolling, which the hold
  // makes sure of).
  function watchTouch(f: Floater, e: TouchEvent) {
    if (e.touches.length !== 1 || !floaters.includes(f)) return;
    const { identifier, clientX: x0, clientY: y0 } = e.touches[0];
    let drag: ReturnType<typeof beginDrag> | null = null;
    hold(f);
    const timer = window.setTimeout(() => (drag = beginDrag(f, x0, y0)), HOLD_TO_DRAG_MS);
    const ours = (ev: TouchEvent) => Array.from(ev.changedTouches).find((t) => t.identifier === identifier);

    const move = (ev: TouchEvent) => {
      const t = ours(ev);
      if (!t) return;
      if (drag) {
        drag.move(t.clientX, t.clientY);
      } else if (Math.hypot(t.clientX - x0, t.clientY - y0) > HOLD_SLOP_PX) {
        stop();
      }
    };
    const end = (ev: TouchEvent) => ours(ev) && stop();
    function stop() {
      window.clearTimeout(timer);
      f.wrap.removeEventListener('touchmove', move);
      f.wrap.removeEventListener('touchend', end);
      f.wrap.removeEventListener('touchcancel', end);
      if (drag) drag.end();
      else release(f);
      drag = null;
    }
    f.wrap.addEventListener('touchmove', move, { passive: true });
    f.wrap.addEventListener('touchend', end);
    f.wrap.addEventListener('touchcancel', end);
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
  // One per word, or on phones a random handful of the words.
  const pickWords = () =>
    Array.from({ length: wordCount }, (_, word) => word)
      .sort(() => Math.random() - 0.5)
      .slice(0, maxOnScreen());
  // The first field's images start downloading straight away, while the
  // page (and its fonts) are still loading, rather than once it's laid out.
  let firstWords: number[] | null = pickWords();
  for (const word of firstWords) {
    if (!wordImages[word]) {
      wordImages[word] = Array.from({ length: IMAGES_PER_WORD }, () => draw());
      wordNext[word] = 0;
    }
    const image = wordImages[word][wordNext[word]];
    preload(image);
    preloadSoft(image);
  }

  // Lays the field out, each image placed in the most open spot left and
  // fading in as soon as it's ready (one after another) — none waits for
  // the slowest to load.
  let buildId = 0;
  async function build() {
    const id = ++buildId;
    floaters.forEach((f) => f.wrap.remove());
    floaters = [];
    measureBaseHeight();
    const words = firstWords ?? pickWords();
    firstWords = null;
    let nextSlot = 0;
    await Promise.all(
      words.map(async (word) => {
        const f = await createFloater(word);
        if (id !== buildId || !f || !moveToOpenSpot(f)) return;
        floaters.push(f);
        const now = performance.now();
        nextSlot = Math.max(nextSlot, now);
        fadeIn(f, nextSlot - now);
        nextSlot += FADE_IN_STAGGER_MS;
      })
    );
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
    // Hands are off while they're flying past, so a faded-out image can't
    // sit over (and swallow taps on) the showreel button.
    layer.classList.toggle('is-zooming', amount > 0);
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
