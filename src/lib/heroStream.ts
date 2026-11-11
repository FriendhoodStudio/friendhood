import type { HeroPopUpImage } from '../types/hero';

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
// columns). Each image then varies a touch around that (only a touch, so
// size keeps tracking depth: big and clear near, small and hazy far), how far it sits
// off the column's centre line, and the gap above it, so the stream doesn't
// read as a tidy grid.
const IMAGE_WIDTH_SHARE = 0.68;
const ITEM_WIDTH_RANGE = [0.95, 1.05];
const ITEM_DRIFT_SHARE = 0.18;
const IMAGE_GAP_RANGE = [0.35, 1.05];
// How much a column's speed may differ from its depth's speed.
const SPEED_JITTER = 0.25;
// How far a column may sit off the centre of its slot, as a share of pitch.
const COLUMN_JITTER = 0.12;
// Resting look and speed (px/s), from nearest column to furthest back.
// The spread is wide so the stream reads as layers: near images are big,
// clearer and quick, far ones small, hazy and slow, and nearer columns sit
// in front where they overlap.
const NEAR = { blur: 30, opacity: 0.8, speed: 42, scale: 1.2 };
const FAR = { blur: 100, opacity: 0.25, speed: 9, scale: 0.6 };
// Moving the mouse shifts each column sideways by up to this much, more for
// nearer columns, for a little parallax.
const PARALLAX_PX = 28;
const PARALLAX_EASE_PER_S = 3;
// Soft copies are blurred once, up front, rather than live with CSS (which
// on moving images is too heavy for Chrome). Each is drawn as a circle on
// a small transparent canvas and blurred there, so the blur works on the
// round bubble itself: colour bleeds softly out past its edge in every
// direction, with no ring where a blurred square was cut to a circle (as
// with Sanity's blur plus a mask). Sizes in canvas pixels: the circle's
// diameter, and the transparent margin the blur spreads into.
const SOFT_DIAMETER = 96;
const SOFT_PAD = 40;
// Blur as a share of the diameter, at the nearest and furthest depth.
const SOFT_BLUR_NEAR = 0.025;
const SOFT_BLUR_FAR = 0.17;
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
const LONG_PRESS_MS = 400;
// "See the project" comes up in the middle of a bubble in focus, after a
// pause, so a passing mouse just sees the image and the label only appears
// once you've settled on it.
const LABEL_DELAY_MS = 650;
const LABEL_IN_MS = 900;
const LABEL_CLASS =
  'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-front/15 bg-grey-600 px-3.5 py-2 font-body text-[0.9375rem] leading-[1.2] text-front backdrop-blur-[14px] whitespace-nowrap pointer-events-none';
// No bubble is smaller than one that fits the label with this much room
// all round it (measured to the circle's edge).
const LABEL_CLEARANCE_PX = 15;
const SPEED_EASE_PER_S = 4;
// As the stage zooms past, each column grows around the screen's centre, so
// it swells and spreads outward, and the stream carries on rising, faster
// (as a share of screen height) for nearer columns, while it fades away.
// Deliberately a different motion from the headline, whose lines part up
// and down and grow much more (see the hero's stage script): the title
// rushing past while the stream rises more slowly behind it, each layer at
// its own pace, is what gives the depth and parallax.
const ZOOM_GROW = { near: 1.6, far: 1.15 };
const ZOOM_RISE = { near: 0.45, far: 0.12 };

interface Item {
  wrap: HTMLAnchorElement;
  card: HTMLElement;
  soft: HTMLImageElement;
  sharp: HTMLImageElement;
  label: HTMLElement;
  image: HeroPopUpImage;
  y: number;
  w: number;
  h: number;
  gap: number;
  focused: boolean;
}

interface Column {
  el: HTMLElement;
  /** The column's twin in the front layer, where a bubble in focus moves. */
  front: HTMLElement;
  items: Item[];
  depth: number;
  speed: number;
  speedNow: number;
  offset: number;
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

  // Behind the headline (z-20) rather than in front of it, clipped to the
  // hero, and running the full height of the screen: from the very top
  // (under the nav, which the floating field avoids) to the very bottom,
  // with no fade at either edge.
  layer.style.zIndex = '10';
  layer.style.overflow = 'hidden';
  layer.style.top = '0';
  layer.style.bottom = '0';
  // A second, matching layer in front of the headline. A bubble in focus
  // moves into it (into its column's twin there, which follows the column
  // exactly), so it comes in front of the other bubbles and the headline.
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

  // Every image is a circle, like a thought bubble rising from the
  // headline, so each is cropped square (the circle is cut from that).
  function ratio(_image: HeroPopUpImage) {
    return 1;
  }

  // One soft bubble per image and blur level, made once and reused.
  const softCache = new Map<string, Promise<string>>();
  function softBubble(image: HeroPopUpImage, depth: number) {
    // A handful of blur levels, so bubbles can be shared between columns.
    const level = Math.round(depth * 4) / 4;
    const key = `${image.url}|${level}`;
    let made = softCache.get(key);
    if (!made) {
      made = makeSoftBubble(image.url, lerp(SOFT_BLUR_NEAR, SOFT_BLUR_FAR, level) * SOFT_DIAMETER);
      softCache.set(key, made);
    }
    return made;
  }

  // Sets (or swaps) the image an item shows, with its own size, sideways
  // drift and gap, all varied around the column's width.
  function fill(item: Item, image: HeroPopUpImage, col: Column) {
    const w = Math.max(col.w * between(ITEM_WIDTH_RANGE), minDiameter);
    const h = w / ratio(image);
    const x = (col.w - w) / 2 + (Math.random() * 2 - 1) * col.w * ITEM_DRIFT_SHARE;
    const scale = w / SOFT_DIAMETER;
    const size = (SOFT_DIAMETER + SOFT_PAD * 2) * scale;
    item.image = image;
    item.w = w;
    item.h = h;
    item.gap = col.w * between(IMAGE_GAP_RANGE);
    item.wrap.style.left = `${x}px`;
    item.wrap.style.width = `${w}px`;
    item.wrap.style.height = `${h}px`;
    item.soft.style.cssText =
      // The soft bubble spreads well past the circle, so it's left out of
      // hit-testing: only the circle itself reacts to the mouse.
      `position:absolute;display:block;max-width:none;pointer-events:none;opacity:0;transition:opacity 400ms ease-out;` +
      `left:${-SOFT_PAD * scale}px;top:${-SOFT_PAD * scale}px;width:${size}px;height:${size}px`;
    item.soft.removeAttribute('src');
    softBubble(image, col.depth).then(
      (url) => {
        if (item.image !== image) return;
        item.soft.src = url;
        item.soft.style.opacity = '';
      },
      () => {}
    );
    item.sharp.src = image.url;
    // Links to the case study it came from (images added by hand in Studio
    // have none, and just sit in the stream).
    if (image.href) {
      item.wrap.href = image.href;
      item.wrap.setAttribute('aria-label', image.project || image.alt);
      item.wrap.style.cursor = 'pointer';
      item.label.hidden = false;
    } else {
      item.wrap.removeAttribute('href');
      item.wrap.removeAttribute('aria-label');
      item.wrap.style.cursor = '';
      item.label.hidden = true;
    }
    item.sharp.alt = '';
    item.sharp.style.opacity = '0';
    item.sharp.getAnimations().forEach((a) => a.cancel());
    item.label.getAnimations().forEach((a) => a.cancel());
    item.soft.getAnimations().forEach((a) => a.cancel());
  }

  function focus(item: Item, col: Column) {
    if (item.focused) return;
    item.focused = true;
    col.hovered++;
    // In front of every other bubble, and the headline, while in focus.
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
    item.label.animate(
      [
        { opacity: 0, transform: 'translateY(10px) scale(0.96)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: LABEL_IN_MS, delay: LABEL_DELAY_MS, easing: 'cubic-bezier(0.3, 0.5, 0.25, 1)', fill: 'both' }
    );
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
      if (!item.focused && item.wrap.parentElement === col.front) col.el.append(item.wrap);
    }, UNFOCUS_MS);
    item.label.getAnimations().forEach((a) => a.cancel());
    item.label.style.opacity = '0';
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
    item.card.animate(
      [
        { transform: getComputedStyle(item.card).transform, opacity: getComputedStyle(item.card).opacity },
        { transform: 'scale(1)', opacity: look(col.depth).opacity },
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
    // A small version of the hero's "Watch our showreel" button, centred in
    // the bubble.
    const label = document.createElement('span');
    label.textContent = 'See the project';
    label.className = LABEL_CLASS;
    label.style.opacity = '0';
    soft.alt = '';
    soft.decoding = 'async';
    sharp.decoding = 'async';
    wrap.style.cssText = `position:absolute;left:0;top:0;display:block;border-radius:50%;pointer-events:auto;will-change:transform;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none`;
    card.style.cssText = `position:relative;width:100%;height:100%;opacity:${look(col.depth).opacity}`;
    sharp.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;opacity:0;max-width:none';
    sharp.draggable = false;
    soft.draggable = false;
    card.append(soft, sharp, label);
    wrap.append(card);
    const item: Item = { wrap, card, soft, sharp, label, image: images[0], y: 0, w: 0, h: 0, gap: 0, focused: false };
    fill(item, draw(), col);

    wrap.addEventListener('pointerenter', (e) => {
      if (e.pointerType === 'mouse') focus(item, col);
    });
    wrap.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') unfocus(item, col);
    });
    // Touch: press to bring it up; let go (or scroll away) to send it back.
    let pressedAt = 0;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') {
        pressedAt = performance.now();
        focus(item, col);
      }
    });
    // On touch, a quick tap follows the link, while pressing and holding is
    // for looking at the image, so letting go after a hold doesn't navigate.
    wrap.addEventListener('click', (e) => {
      if (pressedAt && performance.now() - pressedAt > LONG_PRESS_MS) e.preventDefault();
      pressedAt = 0;
    });
    for (const type of ['pointerup', 'pointercancel'] as const) {
      wrap.addEventListener(type, (e) => {
        if (e.pointerType !== 'mouse') unfocus(item, col);
      });
    }
    wrap.addEventListener('contextmenu', (e) => e.preventDefault());
    return item;
  }

  // The smallest bubble the label fits in with LABEL_CLEARANCE_PX to spare:
  // the circle has to reach the label's corners, plus the clearance.
  let minDiameter = 0;
  function measureLabel() {
    const probe = document.createElement('span');
    probe.className = LABEL_CLASS;
    probe.textContent = 'See the project';
    probe.style.visibility = 'hidden';
    layer.append(probe);
    const { width, height } = probe.getBoundingClientRect();
    probe.remove();
    minDiameter = Math.hypot(width, height) + LABEL_CLEARANCE_PX * 2;
  }

  function build() {
    layer.replaceChildren();
    measureLabel();
    frontLayer.replaceChildren();
    columns = [];
    width = layer.clientWidth;
    const height = layer.clientHeight;
    if (!width || !height) return;
    const count = clamp(Math.round(width / COLUMN_PITCH_PX), MIN_COLUMNS, MAX_COLUMNS);
    const pitch = width / count;
    // Depths spread evenly from near to far, shuffled across the columns, so
    // there's always a clear near and far layer, with a little randomness.
    const depths = Array.from({ length: count }, (_, i) =>
      clamp((count > 1 ? i / (count - 1) : 0.3) + (Math.random() * 2 - 1) * 0.08, 0, 1)
    );
    for (let i = depths.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [depths[i], depths[j]] = [depths[j], depths[i]];
    }
    for (let c = 0; c < count; c++) {
      const depth = depths[c];
      const { scale } = look(depth);
      const speed = look(depth).speed * (1 + (Math.random() * 2 - 1) * SPEED_JITTER);
      const w = pitch * IMAGE_WIDTH_SHARE * scale;
      const centre = pitch * (c + 0.5) + (Math.random() * 2 - 1) * pitch * COLUMN_JITTER;
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;top:0;bottom:0;left:${centre - w / 2}px;width:${w}px;will-change:transform;z-index:${Math.round((1 - depth) * 10)}`;
      const front = document.createElement('div');
      front.style.cssText = el.style.cssText;
      frontLayer.append(front);
      const col: Column = { el, front, items: [], depth, speed, speedNow: reduceMotion ? 0 : speed, offset: 0, centre, w, hovered: 0, shift: 0 };
      // Start part-way through, so the columns don't all begin level.
      let y = -Math.random() * height * 0.5;
      while (y < height * 1.4) {
        const item = makeItem(col);
        item.y = y;
        col.items.push(item);
        el.append(item.wrap);
        y += item.h + item.gap;
      }
      layer.append(el);
      columns.push(col);
    }
    place();
    // Fade in, one column after another.
    columns.forEach((col, i) =>
      col.el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 900, delay: 120 * i, easing: 'ease-out', fill: 'backwards' })
    );
  }

  function place() {
    const height = layer.clientHeight;
    for (const col of columns) {
      // Recycle images that have risen out of the top to the bottom of the
      // column, with a fresh image from the deck.
      const first = col.items[0];
      if (first && !first.focused && first.y + first.h + col.offset < -height * 0.15) {
        const lastItem = col.items[col.items.length - 1];
        col.items.shift();
        fill(first, draw(), col);
        first.y = lastItem.y + lastItem.h + first.gap;
        col.items.push(first);
      }
      for (const item of col.items) item.wrap.style.transform = `translate3d(0, ${item.y + col.offset}px, 0)`;
      const grow = lerp(ZOOM_GROW.near, ZOOM_GROW.far, col.depth);
      col.el.style.transformOrigin = `${width / 2 - (col.centre - col.w / 2)}px ${height / 2}px`;
      const rise = zoom * height * lerp(ZOOM_RISE.near, ZOOM_RISE.far, col.depth);
      col.el.style.transform = `translate3d(${col.shift}px, ${-rise}px, 0)` + (zoom > 0 ? ` scale(${1 + zoom * (grow - 1)})` : '');
      col.front.style.transformOrigin = col.el.style.transformOrigin;
      col.front.style.transform = col.el.style.transform;
    }
  }

  function frame(now: number) {
    raf = 0;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    for (const col of columns) {
      const target = reduceMotion || col.hovered ? 0 : col.speed;
      col.speedNow += (target - col.speedNow) * Math.min(1, dt * SPEED_EASE_PER_S);
      col.offset -= col.speedNow * dt;
      if (!reduceMotion) {
        const shiftTarget = -pointerX * PARALLAX_PX * (1 - col.depth * 0.85);
        col.shift += (shiftTarget - col.shift) * Math.min(1, dt * PARALLAX_EASE_PER_S);
      }
    }
    place();
    schedule();
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
  // Measured again once the real font is in, for bubbles from then on.
  document.fonts?.ready.then(measureLabel);
  schedule();

  return {
    // The stream doesn't follow the headline's words.
    showWord(_index: number) {},
    zoomPast(progress: number) {
      zoom = progress;
      // Gone a little before the stage's end, and hands off while it flies
      // past, so a faded image can't swallow clicks on what's behind.
      layer.style.opacity = progress ? String(clamp(1 - progress * 1.25, 0, 1)) : '';
      layer.style.visibility = progress >= 0.8 ? 'hidden' : '';
      frontLayer.style.opacity = layer.style.opacity;
      frontLayer.style.visibility = layer.style.visibility;
      for (const col of columns) for (const item of col.items) item.wrap.style.pointerEvents = progress ? 'none' : 'auto';
      place();
    },
    setPaused(value: boolean) {
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

// Draws the image as a circle on a transparent canvas and blurs it there
// (a three-pass box blur, close to a Gaussian, on premultiplied colour so
// the edge fades to clear rather than to a dark fringe). Done by hand
// rather than with the canvas's own filter, which older Safari lacks.
async function makeSoftBubble(url: string, blur: number): Promise<string> {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  // Fetched through the site's own /cdn-image path (a rewrite to Sanity's
  // image CDN, in vercel.json and the dev server's proxy): reading pixels
  // back from a canvas needs the image to be same-origin or CORS-allowed,
  // and Sanity only allows the origins listed in the project's settings.
  const path = url.split('?')[0].replace(/^https:\/\/cdn\.sanity\.io\/images\//, '/cdn-image/');
  img.src = `${path}?w=${SOFT_DIAMETER * 2}&h=${SOFT_DIAMETER * 2}&fit=crop&fm=jpg&q=75`;
  await img.decode();
  const size = SOFT_DIAMETER + SOFT_PAD * 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, SOFT_DIAMETER / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(img, SOFT_PAD, SOFT_PAD, SOFT_DIAMETER, SOFT_DIAMETER);
  const data = ctx.getImageData(0, 0, size, size);
  blurRGBA(data.data, size, size, blur);
  ctx.putImageData(data, 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('soft bubble');
  return URL.createObjectURL(blob);
}

function blurRGBA(px: Uint8ClampedArray, w: number, h: number, sigma: number) {
  const n = w * h;
  const ch = [0, 1, 2, 3].map(() => new Float32Array(n));
  for (let i = 0; i < n; i++) {
    const a = px[i * 4 + 3] / 255;
    ch[0][i] = px[i * 4] * a;
    ch[1][i] = px[i * 4 + 1] * a;
    ch[2][i] = px[i * 4 + 2] * a;
    ch[3][i] = px[i * 4 + 3];
  }
  // Box radius for three passes approximating a Gaussian of this sigma.
  const radius = Math.max(1, Math.round(Math.sqrt((12 * sigma * sigma) / 3 + 1) / 2));
  const tmp = new Float32Array(n);
  for (const c of ch) {
    for (let pass = 0; pass < 3; pass++) {
      boxPass(c, tmp, w, h, radius, true);
      boxPass(tmp, c, w, h, radius, false);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = ch[3][i];
    const k = a > 0 ? 255 / a : 0;
    px[i * 4] = ch[0][i] * k;
    px[i * 4 + 1] = ch[1][i] * k;
    px[i * 4 + 2] = ch[2][i] * k;
    px[i * 4 + 3] = a;
  }
}

function boxPass(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, horizontal: boolean) {
  const lines = horizontal ? h : w;
  const len = horizontal ? w : h;
  const step = horizontal ? 1 : w;
  const span = r * 2 + 1;
  for (let line = 0; line < lines; line++) {
    const start = horizontal ? line * w : line;
    let sum = 0;
    // Outside the canvas counts as clear.
    for (let k = 0; k <= r && k < len; k++) sum += src[start + k * step];
    for (let i = 0; i < len; i++) {
      dst[start + i * step] = sum / span;
      const add = i + r + 1;
      const drop = i - r;
      if (add < len) sum += src[start + add * step];
      if (drop >= 0) sum -= src[start + drop * step];
    }
  }
}
