import type { HeroPopUpImage } from '../types/hero';
import { SOFT_H, SOFT_PAD, SOFT_W, softPath } from './heroSoft';

/** An alternative to the floating field (heroPopups): project images rise
 * behind the hero headline in a few slow columns, like a stream, blurred and
 * faded back. Hovering an image (or pressing it on a touch screen) brings it
 * into focus, and its column eases to a stop so it can be looked at; once
 * let go, it goes soft again and the column picks up speed. Each column
 * gets a depth that sets its blur, opacity and speed, so nearer columns are
 * clearer and rise faster. As you scroll, the hero's stage sends the
 * columns apart (zoomPast). Same API as initHeroPopups, so the hero can use
 * either. */

// Columns: roughly one per this much screen width, within these limits.
const COLUMN_PITCH_PX = 380;
const MIN_COLUMNS = 2;
const MAX_COLUMNS = 5;
// Image width as a share of a column's pitch (the rest is the gap between
// columns). All images in a layer are the same size (so there are just two
// sizes, near and back); each varies in how far it sits off the column's
// centre line and the gap above it, so the stream doesn't read as a grid.
const IMAGE_WIDTH_SHARE = 0.68;
const ITEM_DRIFT_SHARE = 0.55;
const IMAGE_GAP_RANGE = [0.4, 1.1];
// How far a column may sit off the centre of its slot, as a share of pitch.
const COLUMN_JITTER = 0.2;
// Images move freely, like things floating up through water: each rises
// at its own speed (its column's, give or take ITEM_SPEED_JITTER) and
// drifts sideways at its own pace (WANDER_PX_S, either way). Nothing
// overlaps: when two touch, near or back, they bounce apart and head off
// in new directions, then ease back to their own rise and drift over a few
// seconds; they also bounce off the sides of the screen. How quickly an image eases back to
// its own course, the space kept between images, and how bouncy a knock is
// (0 dead, 1 fully elastic).
const ITEM_SPEED_JITTER = 0.35;
const WANDER_PX_S = [4, 12];
const COURSE_EASE_PER_S = 0.9;
const BUMP_GAP_PX = 36;
const BOUNCE = 0.45;

// How far back the back layer of images sits, between NEAR (0) and FAR (1).
const BACK_DEPTH = 0.4;
// Share of all the images that pass in front of the headline (sharp and
// solid), drawn from those rising to either side of it; everything else
// passes behind.
const OVER_SHARE = 0.1;
// Resting look and speed (px/s), from nearest column to furthest back.
// The spread is wide so the stream reads as layers: near images are big,
// clearer and quick, far ones small, hazy and slow, and nearer columns sit
// in front where they overlap.
const NEAR = { blur: 32, opacity: 0.65, speed: 42, scale: 1.05 };
const FAR = { blur: 48, opacity: 0.25, speed: 15, scale: 0.6 };
// Moving the mouse shifts each column sideways by up to this much, more for
// nearer columns, for a little parallax.
const PARALLAX_PX = 28;
const PARALLAX_EASE_PER_S = 3;
// On phones: how far the phone has to lean (degrees) for the full effect,
// and how hard a full lean pushes the images sideways (px/s each second).
const TILT_FULL_DEG = 25;
const TILT_PUSH_PX_S2 = 60;
// Tilting forwards or back: how far (degrees) from the resting angle for
// the full change, the slowest and fastest the stream goes, and how
// quickly the resting angle catches up with how the phone is being held.
const PITCH_FULL_DEG = 20;
const PITCH_PACE = [0.25, 2.5];
const REST_SETTLE_PER_S = 0.08;
// Upside down: how far over the phone has to be (the sine of its forwards
// tilt below this), and how fast the images then fall, as a multiple of
// their usual rise.
const UPSIDE_DOWN_SIN = -0.25;
const FALL_PACE = 2.2;
// Hover: how much the image grows, how long it takes to come into focus
// and go soft again, and how quickly its column slows and recovers.
const HOVER_SCALE = 1.12;
const FOCUS_MS = 450;
const UNFOCUS_MS = 700;
// Blurry to sharp (and back) is near-instant rather than a slow dissolve,
// which passes through a muddy half-blurred stage. The sharp image is
// loaded as soon as an image enters the stream (they're small, 600px
// wide), so it's ready the moment it's hovered.
const SWAP_MS = 90;
// The label comes up along the bottom of an image in focus, after a pause
// (so a passing mouse just sees the image and the label only appears once
// you've settled on it): a pill with the project's name running through it
// like a ticker tape, fading out at either end.
const LABEL_DELAY_MS = 650;
const LABEL_IN_MS = 900;
const LABEL_CLASS =
  'absolute bottom-[18px] inset-x-0 mx-auto w-[87%] block overflow-hidden rounded-full border border-front/15 bg-grey-600 py-2 font-body text-[0.9375rem] leading-[1.2] text-front backdrop-blur-[14px] whitespace-nowrap pointer-events-none';
// The ticker's speed, how many copies of the name run round it (enough to
// fill the pill however short the name), and how far in from each end of
// the pill the name fades.
const TICKER_PX_S = 28;
const TICKER_COPIES = 8;
const TICKER_FADE = 'linear-gradient(to right, transparent, #000 18%, #000 82%, transparent)';
// The label sits this far up from the image's bottom edge, centred, and no image is
// narrower than LABEL_MIN_WIDTH_PX plus that either side.
const LABEL_CLEARANCE_PX = 18;
const LABEL_MIN_WIDTH_PX = 150;
// On narrow screens, the most of the screen's width an image's minimum may
// take up.
const PHONE_MAX_SHARE = 0.36;
const SPEED_EASE_PER_S = 4;
// As the stage zooms past, each column grows around the screen's centre, so
// it swells and spreads outward, and the stream carries on rising, faster
// (as a share of screen height) for nearer columns, while it fades away.
// Deliberately a different motion from the headline, whose lines part up
// and down and grow much more (see the hero's stage script): the title
// rushing past while the stream rises more slowly behind it, each layer at
// its own pace, is what gives the depth and parallax.
const ZOOM_GROW = { near: 1.6, far: 1.15 };
// How far into the zoom the stream counts as scrolled away (images let go
// and stop taking taps).
const ZOOM_AWAY = 0.03;
const ZOOM_RISE = { near: 0.45, far: 0.12 };

interface Item {
  wrap: HTMLAnchorElement;
  card: HTMLElement;
  soft: HTMLImageElement;
  sharp: HTMLImageElement;
  label: HTMLElement;
  /** The strip of repeated project names that runs through the label. */
  ticker: HTMLElement;
  stroke: HTMLElement;
  image: HeroPopUpImage;
  /** Position (x from the column's left edge) and velocity, in px and px/s. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Its own rising speed and sideways drift (px/s) when nothing's in the way. */
  rise: number;
  wander: number;
  w: number;
  h: number;
  gap: number;
  focused: boolean;
  /** Sits in front of the headline (multiplied over it) rather than behind. */
  over: boolean;
  /** Shown sharp and solid at rest, rather than soft and faded: every image
   * in front of the headline, and on screens with no room beside it, a few
   * behind it instead. */
  crisp: boolean;
  /** In front of the headline but kept out of its middle (only where
   * there's room beside it). */
  keepClear: boolean;
}

interface Column {
  el: HTMLElement;
  /** The column's twin in the front layer, where a image in focus moves. */
  front: HTMLElement;
  /** Its twin in the layer in front of the headline (see overLayer). */
  over: HTMLElement;
  items: Item[];
  depth: number;
  speed: number;
  speedNow: number;
  centre: number;
  w: number;
  hovered: number;
  shift: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const between = ([min, max]: number[]) => min + Math.random() * (max - min);

export function initHeroStream(layer: HTMLElement, images: HeroPopUpImage[]) {
  if (images.length < 2) return null;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let columns: Column[] = [];
  let paused = false;
  let inView = true;
  let zoom = 0;
  let raf = 0;
  let last = 0;
  let width = 0;
  let deck: HeroPopUpImage[] = [];
  let pointerX = 0;
  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse') pointerX = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
    },
    { passive: true }
  );

  // On a phone, tilting it stands in for the mouse: leaning it left or right
  // shifts the layers for the same parallax, and the images drift the way
  // it leans (see TILT_PUSH_PX_S2 in move). Safari on iPhone only gives the
  // tilt once asked, from a tap, so it's asked on the first tap anywhere.
  let tilt = 0;
  // Speed multiplier from tilting forwards or back, and the resting angle
  // it's measured from.
  let pace = 1;
  let restBeta: number | null = null;
  let lastBetaAt = 0;
  if (!reduceMotion && window.matchMedia('(pointer: coarse)').matches && 'DeviceOrientationEvent' in window) {
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null) return;
      // The phone's left/right lean, in degrees, turned sideways if it's
      // held in landscape.
      const angle = (screen.orientation?.angle ?? 0) % 180 === 0 ? e.gamma : (e.beta ?? 0) * (screen.orientation.angle === 90 ? 1 : -1);
      tilt = clamp(angle / TILT_FULL_DEG, -1, 1);
      pointerX = -tilt;
      // Forwards and back (held upright): measured from however the phone
      // is naturally being held, which the reading slowly settles towards.
      // Leaning the top away speeds the stream up; towards you slows it.
      if ((screen.orientation?.angle ?? 0) % 180 === 0 && e.beta != null) {
        const now = performance.now();
        // Turned upside down (the top of the screen pointing down), the
        // images fall instead, as if gravity had taken over; the resting
        // angle holds still meanwhile, so turning back picks up as before.
        if (Math.sin((e.beta * Math.PI) / 180) < UPSIDE_DOWN_SIN) {
          pace = -FALL_PACE;
          lastBetaAt = now;
          return;
        }
        if (restBeta == null) restBeta = e.beta;
        else restBeta += (e.beta - restBeta) * Math.min(1, ((now - lastBetaAt) / 1000) * REST_SETTLE_PER_S);
        lastBetaAt = now;
        pace = clamp(1 + (restBeta - e.beta) / PITCH_FULL_DEG, PITCH_PACE[0], PITCH_PACE[1]);
      }
    };
    const ask = (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission;
    if (typeof ask === 'function') {
      document.addEventListener(
        'touchend',
        () => {
          ask.call(DeviceOrientationEvent).then(
            (answer) => answer === 'granted' && window.addEventListener('deviceorientation', onTilt),
            () => {}
          );
        },
        { once: true, passive: true }
      );
    } else {
      window.addEventListener('deviceorientation', onTilt);
    }
  }

  // Behind the headline (z-20) rather than in front of it, clipped to the
  // hero, and running the full height of the screen: from the very top
  // (under the nav, which the floating field avoids) to the very bottom,
  // with no fade at either edge.
  layer.style.zIndex = '10';
  layer.style.overflow = 'hidden';
  layer.style.top = '0';
  layer.style.bottom = '0';
  // A second, matching layer in front of the headline. A image in focus
  // moves into it (into its column's twin there, which follows the column
  // exactly), so it comes in front of the other images and the headline.
  const frontLayer = document.createElement('div');
  frontLayer.className = layer.className;
  // Including Astro's scoping attribute, so the hero's layer styles (its
  // position and width) apply to it too.
  for (const attr of layer.getAttributeNames()) {
    if (attr.startsWith('data-astro-cid')) frontLayer.setAttribute(attr, '');
  }
  frontLayer.setAttribute('aria-hidden', 'true');
  frontLayer.style.cssText = 'z-index:30;overflow:hidden;top:0;bottom:0';
  layer.after(frontLayer);
  // And one between the headline and the front layer, for the images that
  // pass in front of the headline rather than behind it, covering its
  // letters as they go. (Multiply was tried here, but letting the letters
  // show through lost the effect of passing in front.)
  const overLayer = frontLayer.cloneNode(false) as HTMLElement;
  overLayer.style.cssText = 'z-index:25;overflow:hidden;top:0;bottom:0';
  layer.after(overLayer);
  const home = (item: Item, col: Column) => (item.over ? col.over : col.el);
  // Images behind the headline are faded back by depth; those passing in
  // front of it are solid, so they properly cover the letters.
  const restingOpacity = (item: Item, col: Column) => (item.crisp ? 1 : look(col.depth).opacity);

  function draw() {
    if (deck.length === 0) {
      deck = [...images];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    return deck.pop()!;
  }

  function look(depth: number) {
    return {
      blur: Math.round(lerp(NEAR.blur, FAR.blur, depth)),
      opacity: lerp(NEAR.opacity, FAR.opacity, depth),
      speed: lerp(NEAR.speed, FAR.speed, depth),
      scale: lerp(NEAR.scale, FAR.scale, depth),
    };
  }

  // Every image is cropped to the same portrait shape, 4:5 (as on the
  // site's portrait cards).
  function ratio(_image: HeroPopUpImage) {
    return 4 / 5;
  }


  // Sets (or swaps) the image an item shows, with its own size, sideways
  // drift and gap, all varied around the column's width.
  function fill(item: Item, image: HeroPopUpImage, col: Column) {
    // Never smaller than fits the label with room around it.
    const w = Math.max(col.w, minWidth, minHeight * ratio(image));
    const h = w / ratio(image);
    const x = (col.w - w) / 2 + (Math.random() * 2 - 1) * col.w * ITEM_DRIFT_SHARE;
    const scale = w / SOFT_W;
    item.image = image;
    item.w = w;
    item.h = h;
    // Gaps scale with the image itself, so small screens (where images sit
    // at their minimum size in narrow columns) aren't packed tight.
    item.gap = h * between(IMAGE_GAP_RANGE);
    item.x = x;
    // Some in front of the headline, the rest behind (a fresh pick each time
    // an image comes round again). Only images rising to the left or right
    // of the headline can be in front, so it's never covered; they bounce
    // off its edges rather than drift across it (see move).
    const centre = col.centre - col.w / 2 + x + w / 2;
    // Kept to OVER_SHARE of all images by count rather than by chance, as
    // only some rise at the sides.
    const all = columns.flatMap((c) => c.items).filter((other) => other !== item);
    const crispNow = all.filter((other) => other.crisp).length;
    // And only where there's room for the whole image beside the headline:
    // on a phone the words span nearly the full width, and an image
    // squeezed between them and the screen's edge was pushed back and forth
    // by both every frame (a flicker), so there none come in front.
    const roomLeft = title.l >= w;
    const roomRight = width - title.r >= w;
    const side = (centre < title.l && roomLeft) || (centre > title.r && roomRight);
    const pick = crispNow + 1 <= Math.max(1, Math.round(OVER_SHARE * (all.length + 1)));
    // With no room either side (phones), the share still comes up sharp and
    // in front, and simply passes over the headline: there are few enough
    // that covering the words now and then is fine, and they skip the
    // middle band (there's nowhere beside it to go).
    const noRoom = !roomLeft && !roomRight;
    item.over = pick && (side || noRoom);
    item.keepClear = item.over && side;
    item.crisp = item.over;
    // An image in front starts with its inner edge over the end of the
    // headline (but clear of the middle band), so it rises across the
    // title's outer words.
    if (item.keepClear) {
      const layerX =
        centre < title.l
          ? Math.min(words.l + w * WORDS_OVERLAP, title.l) - w
          : Math.max(words.r - w * WORDS_OVERLAP, title.r);
      item.x = layerX - (col.centre - col.w / 2);
    }
    // Images in front drift in towards the headline (and bounce off the
    // middle band), so they pass over its outer words rather than hanging
    // about at the screen's edge.
    if (!item.focused) {
      home(item, col).append(item.wrap);
      item.card.getAnimations().forEach((a) => a.cancel());
      item.card.style.opacity = String(restingOpacity(item, col));
    }
    item.rise = col.speed * (1 + (Math.random() * 2 - 1) * ITEM_SPEED_JITTER);
    item.wander = between(WANDER_PX_S) * (item.keepClear ? (centre < title.l ? 1 : -1) : Math.random() < 0.5 ? -1 : 1);
    item.vx = item.wander;
    item.vy = -item.rise;
    item.wrap.style.width = `${w}px`;
    item.wrap.style.height = `${h}px`;
    // The blurred copy is made at build time, already rounded to the card
    // radius before it was blurred (see heroSoft.ts), so its corners match
    // the sharp image's with no masking or clipping here. Its blur spreads
    // into the padding around the image, so it's left out of hit-testing:
    // only the image itself reacts to the mouse. Sharp images skip it.
    if (item.crisp) item.soft.removeAttribute('src');
    else item.soft.src = softPath(image.url, col.depth > 0 ? 'back' : 'near');
    item.soft.style.cssText =
      `position:absolute;display:block;max-width:none;pointer-events:none;` +
      `left:${-SOFT_PAD * scale}px;top:${-SOFT_PAD * scale}px;` +
      `width:${(SOFT_W + SOFT_PAD * 2) * scale}px;height:${(SOFT_H + SOFT_PAD * 2) * scale}px`;
    if (item.crisp) item.soft.style.display = 'none';
    item.sharp.src = image.url;
    // Links to the case study it came from (images added by hand in Studio
    // have none, and just sit in the stream).
    if (image.href) {
      item.wrap.href = image.href;
      item.wrap.setAttribute('aria-label', image.project || image.alt);
      item.wrap.style.cursor = 'pointer';
      item.label.hidden = false;
      // The client's name, then the project's short card copy, with a dot
      // (given some room either side) between them and between repeats.
      const parts = [image.project || 'See project', image.detail].filter(Boolean) as string[];
      item.ticker.replaceChildren(
        ...Array.from({ length: TICKER_COPIES }, () => {
          const copy = document.createElement('span');
          copy.style.display = 'inline-flex';
          for (const part of parts) {
            const dot = document.createElement('span');
            dot.textContent = '•';
            dot.style.margin = '0 0.6em';
            copy.append(part, dot);
          }
          return copy;
        })
      );
    } else {
      item.wrap.removeAttribute('href');
      item.wrap.removeAttribute('aria-label');
      item.wrap.style.cursor = '';
      item.label.hidden = true;
    }
    item.sharp.alt = '';
    item.sharp.style.opacity = item.crisp ? '1' : '0';
    item.sharp.getAnimations().forEach((a) => a.cancel());
    item.label.getAnimations().forEach((a) => a.cancel());
    item.ticker.getAnimations().forEach((a) => a.cancel());
    item.soft.getAnimations().forEach((a) => a.cancel());
  }

  // The image a tap has brought into focus on a touch screen, if any.
  let touchFocused: Item | null = null;
  let touchCol: Column | null = null;
  function releaseTouch() {
    if (touchFocused && touchCol) unfocus(touchFocused, touchCol);
    touchFocused = touchCol = null;
  }
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType !== 'mouse' && touchFocused && !touchFocused.wrap.contains(e.target as Node)) releaseTouch();
    },
    { passive: true }
  );

  function focus(item: Item, col: Column) {
    if (item.focused) return;
    item.focused = true;
    col.hovered++;
    // In front of every other image, and the headline, while in focus.
    if (item.wrap.parentElement !== col.front) col.front.append(item.wrap);
    // The soft copy is blurred past the image's edges, so it fades out as
    // the sharp one comes in: no glow around the image in focus.
    const show = () => {
      if (!item.focused) return;
      item.sharp.animate([{ opacity: getComputedStyle(item.sharp).opacity }, { opacity: 1 }], {
        duration: SWAP_MS,
        easing: 'linear',
        fill: 'forwards',
      });
      item.soft.animate([{ opacity: getComputedStyle(item.soft).opacity }, { opacity: 0 }], {
        duration: SWAP_MS,
        easing: 'linear',
        fill: 'forwards',
      });
    };
    item.sharp.decode().then(show, show);
    item.stroke.style.opacity = '1';
    item.label.animate(
      [
        { opacity: 0, transform: 'translateY(10px) scale(0.96)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: LABEL_IN_MS, delay: LABEL_DELAY_MS, easing: 'cubic-bezier(0.3, 0.5, 0.25, 1)', fill: 'both' }
    );
    // The names run right to left, one copy's width per loop, so it wraps
    // round seamlessly.
    const copy = item.ticker.firstElementChild as HTMLElement | null;
    if (copy && !reduceMotion) {
      item.ticker.getAnimations().forEach((a) => a.cancel());
      const span = copy.offsetWidth;
      item.ticker.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-span}px)` }], {
        duration: (span / TICKER_PX_S) * 1000,
        iterations: Infinity,
      });
    }
    item.card.animate(
      [
        { transform: getComputedStyle(item.card).transform, opacity: getComputedStyle(item.card).opacity },
        { transform: `scale(${HOVER_SCALE})`, opacity: 1 },
      ],
      { duration: FOCUS_MS, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' }
    );
  }

  function unfocus(item: Item, col: Column) {
    if (!item.focused) return;
    item.focused = false;
    col.hovered = Math.max(0, col.hovered - 1);
    // Back to its own depth once it has shrunk back, so it doesn't pop
    // behind its neighbours (or the headline) mid-way.
    window.setTimeout(() => {
      if (!item.focused && item.wrap.parentElement === col.front) home(item, col).append(item.wrap);
    }, UNFOCUS_MS);
    item.label.getAnimations().forEach((a) => a.cancel());
    item.label.style.opacity = '0';
    item.ticker.getAnimations().forEach((a) => a.cancel());
    item.stroke.style.opacity = '0';
    // Images in front of the headline stay sharp; the rest go soft again.
    if (!item.crisp) {
      item.soft.animate([{ opacity: getComputedStyle(item.soft).opacity }, { opacity: 1 }], {
        duration: SWAP_MS,
        easing: 'linear',
        fill: 'forwards',
      });
      item.sharp.animate([{ opacity: getComputedStyle(item.sharp).opacity }, { opacity: 0 }], {
        duration: SWAP_MS,
        easing: 'linear',
        fill: 'forwards',
      });
    }
    item.card.animate(
      [
        { transform: getComputedStyle(item.card).transform, opacity: getComputedStyle(item.card).opacity },
        { transform: 'scale(1)', opacity: restingOpacity(item, col) },
      ],
      { duration: UNFOCUS_MS, easing: 'ease-in-out', fill: 'forwards' }
    );
  }

  function makeItem(col: Column) {
    // A link, so a click (or a tap) opens the image's case study. Out of the
    // tab order: the layer is decorative (aria-hidden) and the same case
    // studies are reachable from Work.
    const wrap = document.createElement('a');
    wrap.tabIndex = -1;
    wrap.draggable = false;
    const card = document.createElement('div');
    const soft = document.createElement('img');
    const sharp = document.createElement('img');
    // A small version of the hero's "Watch our showreel" button, in the corner of
    // the image.
    const label = document.createElement('span');
    label.className = LABEL_CLASS;
    label.style.opacity = '0';
    // The names run inside a window that fades them out at either end.
    const window_ = document.createElement('span');
    window_.className = 'block overflow-hidden';
    window_.style.setProperty('-webkit-mask-image', TICKER_FADE);
    window_.style.setProperty('mask-image', TICKER_FADE);
    const ticker = document.createElement('span');
    ticker.className = 'inline-flex will-change-transform';
    window_.append(ticker);
    label.append(window_);
    soft.alt = '';
    soft.decoding = 'async';
    sharp.decoding = 'async';
    wrap.style.cssText = `position:absolute;left:0;top:0;display:block;border-radius:var(--radius-card);pointer-events:auto;will-change:transform;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none`;
    card.style.cssText = 'position:relative;width:100%;height:100%';
    sharp.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:var(--radius-card);opacity:0;max-width:none';
    sharp.draggable = false;
    soft.draggable = false;
    // The same thin light stroke as the nav pill and the services buttons,
    // shown while the image is in focus.
    const stroke = document.createElement('span');
    stroke.className = 'pointer-events-none absolute inset-0 rounded-card border border-front/15';
    stroke.style.cssText = 'opacity:0;transition:opacity 300ms ease-out';
    card.append(soft, sharp, stroke, label);
    wrap.append(card);
    const item: Item = { wrap, card, soft, sharp, label, ticker, stroke, image: images[0], x: 0, y: 0, vx: 0, vy: 0, rise: 0, wander: 0, w: 0, h: 0, gap: 0, focused: false, over: false, crisp: false, keepClear: false };
    fill(item, draw(), col);

    wrap.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') focus(item, col);
    });
    wrap.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') unfocus(item, col);
    });
    // Touch has no hover, so a tap stands in for it: the first tap brings
    // the image into focus (and, after the pause, its label) and holds it
    // there; a second tap opens the case study. Tapping elsewhere, another
    // image, or scrolling sends it back. Acting on the finished tap rather
    // than the press means a swipe to scroll never sets it off.
    let pointerType = '';
    wrap.addEventListener('pointerdown', (e) => {
      pointerType = e.pointerType;
    });
    wrap.addEventListener('click', (e) => {
      if (pointerType === 'mouse' || !pointerType) return;
      if (touchFocused === item) return;
      e.preventDefault();
      releaseTouch();
      touchFocused = item;
      touchCol = col;
      focus(item, col);
    });
    wrap.addEventListener('contextmenu', (e) => e.preventDefault());
    wrap.style.setProperty('-webkit-tap-highlight-color', 'transparent');
    return item;
  }

  // The smallest image the label fits in with LABEL_CLEARANCE_PX to spare.
  let minWidth = 0;
  let minHeight = 0;
  function measureLabel() {
    const probe = document.createElement('span');
    probe.className = LABEL_CLASS;
    probe.textContent = 'Ag';
    probe.style.visibility = 'hidden';
    layer.append(probe);
    const { height } = probe.getBoundingClientRect();
    probe.remove();
    // On a phone that minimum would make two images fill the screen edge
    // to edge, so there it's a share of the screen instead, leaving room
    // between them (the ticker label just runs narrower).
    minWidth = Math.min(LABEL_MIN_WIDTH_PX + LABEL_CLEARANCE_PX * 2, (layer.clientWidth || window.innerWidth) * PHONE_MAX_SHARE);
    minHeight = height + LABEL_CLEARANCE_PX * 2;
  }

  // The middle of the headline, in the layer's coordinates: the band the
  // images in front of it keep out of, all the way up the screen, so they
  // can pass over its outer words but never run straight up through the
  // middle. As a share of the width of the headline's words.
  const TITLE_BAND_SHARE = 0.45;
  // How much of an image in front starts over the headline's end.
  const WORDS_OVERLAP = 0.6;
  let title = { l: 0, r: 0 };
  // And the words' own left and right edges.
  let words = { l: 0, r: 0 };
  function measureTitle() {
    const headline = layer.parentElement?.querySelector('h1');
    if (!headline) return;
    // The words themselves, not the heading's box (which is a fixed column
    // width, much wider than the text).
    const range = document.createRange();
    range.selectNodeContents(headline);
    const h = range.getBoundingClientRect();
    const box = layer.getBoundingClientRect();
    const middle = (h.left + h.right) / 2 - box.left;
    const half = (h.width * TITLE_BAND_SHARE) / 2;
    title = { l: middle - half, r: middle + half };
    words = { l: h.left - box.left, r: h.right - box.left };
  }

  function build() {
    measureTitle();
    touchFocused = touchCol = null;
    layer.replaceChildren();
    measureLabel();
    frontLayer.replaceChildren();
    overLayer.replaceChildren();
    columns = [];
    width = layer.clientWidth;
    const height = layer.clientHeight;
    if (!width || !height) return;
    const count = clamp(Math.round(width / COLUMN_PITCH_PX), MIN_COLUMNS, MAX_COLUMNS);
    const pitch = width / count;
    // Two layers, near and back, shared out evenly and shuffled across the
    // columns: just two image sizes. The back layer sits part-way to FAR
    // rather than all the way, so nothing ends up tiny and very hazy.
    const depths = Array.from({ length: count }, (_, i): number => (i % 2 ? BACK_DEPTH : 0));
    for (let i = depths.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [depths[i], depths[j]] = [depths[j], depths[i]];
    }
    for (let c = 0; c < count; c++) {
      const depth = depths[c];
      const { scale } = look(depth);
      const speed = look(depth).speed;
      const w = pitch * IMAGE_WIDTH_SHARE * scale;
      const centre = pitch * (c + 0.5) + (Math.random() * 2 - 1) * pitch * COLUMN_JITTER;
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;top:0;bottom:0;left:${centre - w / 2}px;width:${w}px;will-change:transform;z-index:${Math.round((1 - depth) * 10)}`;
      const front = document.createElement('div');
      front.style.cssText = el.style.cssText;
      frontLayer.append(front);
      const over = document.createElement('div');
      over.style.cssText = el.style.cssText;
      overLayer.append(over);
      const col: Column = { el, front, over, items: [], depth, speed, speedNow: reduceMotion ? 0 : speed, centre, w, hovered: 0, shift: 0 };
      // Listed straight away, so its images count towards OVER_SHARE as they're made.
      columns.push(col);
      // Start part-way through, so the columns don't all begin level.
      let y = -Math.random() * height * 0.5;
      while (y < height * 1.4) {
        const item = makeItem(col);
        item.y = y;
        col.items.push(item);
        y += item.h + item.gap;
      }
      layer.append(el);
    }
    place();
    // Fade in, one column after another.
    columns.forEach((col, i) =>
      [col.el, col.over].forEach((el) =>
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 120 * i, easing: 'ease-out', fill: 'backwards' })
      )
    );
  }

  function place() {
    const height = layer.clientHeight;
    for (const col of columns) {
      // Recycle images that have risen out of the top to the bottom of the
      // column, with a fresh image from the deck.
      const gone = col.items.find((item) => !item.focused && item.y + item.h < -height * 0.15);
      if (gone) {
        const lowest = Math.max(...col.items.filter((item) => item !== gone).map((item) => item.y + item.h + item.gap), 0);
        col.items.splice(col.items.indexOf(gone), 1);
        fill(gone, draw(), col);
        gone.y = Math.max(lowest, height * 1.05);
        col.items.push(gone);
      }
      // And, while they're falling (phone upside down), ones that drop out
      // of the bottom come back in above the top.
      const fallen = col.items.find((item) => !item.focused && item.y > height * 1.15);
      if (fallen && pace < 0) {
        const highest = Math.min(...col.items.filter((item) => item !== fallen).map((item) => item.y - item.gap), height);
        col.items.splice(col.items.indexOf(fallen), 1);
        fill(fallen, draw(), col);
        fallen.y = Math.min(highest, -height * 0.05) - fallen.h;
        col.items.unshift(fallen);
      }
      for (const item of col.items) item.wrap.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
      const grow = lerp(ZOOM_GROW.near, ZOOM_GROW.far, col.depth);
      col.el.style.transformOrigin = `${width / 2 - (col.centre - col.w / 2)}px ${height / 2}px`;
      const rise = zoom * height * lerp(ZOOM_RISE.near, ZOOM_RISE.far, col.depth);
      col.el.style.transform = `translate3d(${col.shift}px, ${-rise}px, 0)` + (zoom > 0 ? ` scale(${1 + zoom * (grow - 1)})` : '');
      for (const twin of [col.front, col.over]) {
        twin.style.transformOrigin = col.el.style.transformOrigin;
        twin.style.transform = col.el.style.transform;
      }
    }
  }

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    for (const col of columns) {
      const target = reduceMotion ? 0 : col.speed;
      col.speedNow += (target - col.speedNow) * Math.min(1, dt * SPEED_EASE_PER_S);
      if (!reduceMotion) {
        const shiftTarget = -pointerX * PARALLAX_PX * (1 - col.depth * 0.85);
        col.shift += (shiftTarget - col.shift) * Math.min(1, dt * PARALLAX_EASE_PER_S);
      }
    }
    if (dt) move(dt);
    place();
    schedule();
  }

  function box(item: Item, left: number) {
    const grow = item.focused ? (HOVER_SCALE - 1) / 2 : 0;
    const l = left + item.x - item.w * grow;
    const t = item.y - item.h * grow;
    return { l, t, r: l + item.w * (1 + grow * 2), b: t + item.h * (1 + grow * 2) };
  }

  // Moves every image on by its velocity, then knocks apart any that touch.
  function move(dt: number) {
    const all: { item: Item; col: Column; left: number }[] = [];
    for (const col of columns) {
      const left = col.centre - col.w / 2;
      for (const item of col.items) {
        all.push({ item, col, left });
        if (item.focused) {
          item.vx = item.vy = 0;
          continue;
        }
        // Back towards its own course after a knock (and to a stop, with
        // the rest, under reduced motion).
        const colPace = col.speed ? col.speedNow / col.speed : 0;
        const ease = Math.min(1, dt * COURSE_EASE_PER_S);
        item.vy += (-item.rise * colPace * pace - item.vy) * ease;
        item.vx += (item.wander * colPace - item.vx) * ease;
        // Leaning the phone sends the images drifting that way.
        item.vx += tilt * TILT_PUSH_PX_S2 * colPace * dt;
        item.x += item.vx * dt;
        item.y += item.vy * dt;
        // Off the sides of the screen.
        const leftEdge = left + item.x;
        if (leftEdge < 0 && item.vx < 0) {
          item.x = -left;
          item.vx = -item.vx;
          item.wander = Math.abs(item.wander);
        } else if (leftEdge + item.w > width && item.vx > 0) {
          item.x = width - left - item.w;
          item.vx = -item.vx;
          item.wander = -Math.abs(item.wander);
        }
        // Images in front of the headline keep out of the middle of the
        // screen (the band as wide as the headline's words), all the way up,
        // so they never run up through the title. The band's edges work like
        // the screen's: an image drifting in bounces back out. (Running the
        // full height, they can only ever meet it side-on, slowly, so it
        // never jumps.)
        if (item.keepClear) {
          const l = left + item.x;
          // If another image knocks one deep in, it's eased back out over a
          // few frames rather than snapped.
          const ease = Math.min(1, dt * 12);
          if (l + item.w / 2 < (title.l + title.r) / 2) {
            if (l + item.w > title.l) {
              item.x += (title.l - item.w - left - item.x) * ease;
              item.vx = -Math.abs(item.vx);
              item.wander = -Math.abs(item.wander);
            }
          } else if (l < title.r) {
            item.x += (title.r - left - item.x) * ease;
            item.vx = Math.abs(item.vx);
            item.wander = Math.abs(item.wander);
          }
        }
      }
    }
    // Every pair, as boxes with BUMP_GAP_PX kept between them: pushed apart
    // along whichever way they overlap least, and their speeds along that
    // way exchanged with some bounce. An image in focus doesn't budge
    // (the others bounce off it). Heavier (bigger) images push harder.
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (a.item.focused && b.item.focused) continue;
        // An image in focus is drawn HOVER_SCALE bigger (around its centre),
        // so it takes up that much more room.
        const A = box(a.item, a.left);
        const B = box(b.item, b.left);
        const ox = Math.min(A.r, B.r) - Math.max(A.l, B.l) + BUMP_GAP_PX;
        if (ox <= 0) continue;
        const oy = Math.min(A.b, B.b) - Math.max(A.t, B.t) + BUMP_GAP_PX;
        if (oy <= 0) continue;
        const ia = a.item.focused ? 0 : 1 / (a.item.w * a.item.h);
        const ib = b.item.focused ? 0 : 1 / (b.item.w * b.item.h);
        const share = ia + ib;
        if (!share) continue;
        const horizontal = ox < oy;
        // Which way b sits from a, along that axis.
        const dir = horizontal ? Math.sign(B.l + B.r - A.l - A.r) || 1 : Math.sign(B.t + B.b - A.t - A.b) || 1;
        // Half the overlap is cleared each frame, so a knock eases apart over
        // a few frames instead of jumping; up against an image in focus
        // (which never moves, and mustn't be covered) it's cleared at once.
        const push = (horizontal ? ox : oy) * (a.item.focused || b.item.focused ? 1 : 0.5);
        const va = horizontal ? a.item.vx : a.item.vy;
        const vb = horizontal ? b.item.vx : b.item.vy;
        const closing = (vb - va) * dir;
        const impulse = closing < 0 ? (-(1 + BOUNCE) * closing) / share : 0;
        if (horizontal) {
          a.item.x -= dir * push * (ia / share);
          b.item.x += dir * push * (ib / share);
          a.item.vx -= dir * impulse * ia;
          b.item.vx += dir * impulse * ib;
        } else {
          a.item.y -= dir * push * (ia / share);
          b.item.y += dir * push * (ib / share);
          a.item.vy -= dir * impulse * ia;
          b.item.vy += dir * impulse * ib;
        }
      }
    }
  }

  function schedule() {
    if (raf || paused || !inView || document.hidden) {
      if (!raf) last = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    schedule();
  }).observe(layer);
  document.addEventListener('visibilitychange', schedule);

  let resizeTimer = 0;
  new ResizeObserver(() => {
    if (Math.abs(layer.clientWidth - width) < 2) return;
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(build, 200);
  }).observe(layer);

  build();
  // Measured again once the real font is in, for images from then on.
  document.fonts?.ready.then(() => {
    measureLabel();
    measureTitle();
  });
  schedule();

  return {
    // The stream doesn't follow the headline's words.
    showWord(_index: number) {},
    zoomPast(progress: number) {
      // Only a real scroll counts: on phones the stage can sit a hair past
      // zero at rest (the browser's toolbar, overscroll at the top), and
      // treating that as "flying past" dropped tapped images and switched
      // off taps altogether.
      const away = progress > ZOOM_AWAY;
      if (away) releaseTouch();
      zoom = progress;
      // Gone a little before the stage's end, and hands off while it flies
      // past, so a faded image can't swallow clicks on what's behind.
      layer.style.opacity = progress ? String(clamp(1 - progress * 1.25, 0, 1)) : '';
      layer.style.visibility = progress >= 0.8 ? 'hidden' : '';
      for (const twin of [frontLayer, overLayer]) {
        twin.style.opacity = layer.style.opacity;
        twin.style.visibility = layer.style.visibility;
      }
      for (const col of columns) for (const item of col.items) item.wrap.style.pointerEvents = away ? 'none' : 'auto';
      place();
    },
    setPaused(value: boolean) {
      if (value && !paused) releaseTouch();
      paused = value;
      if (paused && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
      schedule();
    },
  };
}

