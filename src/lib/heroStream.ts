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
const ITEM_DRIFT_SHARE = 0.55;
// Each image also sways gently side to side as it rises, by up to this
// share of its column's width, over roughly this many seconds a swing, so
// the stream reads as drifting rather than running on rails.
const SWAY_SHARE = 0.12;
const SWAY_PERIOD_S = [9, 15];
const IMAGE_GAP_RANGE = [0.6, 1.6];
// How much a column's speed may differ from its depth's speed.
const SPEED_JITTER = 0.25;
// How far a column may sit off the centre of its slot, as a share of pitch.
const COLUMN_JITTER = 0.2;
// Images are pushed about rather than placed: each eases towards its
// column's rising speed and (sideways) back towards its own line plus sway,
// and when two touch they bounce apart. How quickly an image takes up its
// column's speed, how strongly it's pulled back to its line, how fast
// sideways movement dies away, the space kept between images, and how
// bouncy a knock is (0 dead, 1 fully elastic).
const RISE_EASE_PER_S = 1.2;
const HOME_SPRING = 0.8;
const SIDE_DAMPING_PER_S = 1.4;
const BUMP_GAP_PX = 10;
const BOUNCE = 0.55;
// Only images at about the same depth knock into each other; a near one
// passes in front of a far one, as it would. (Colliding across depths also
// jammed narrow screens, where the near column got held to the far one's
// pace.) As a share of the near-to-far range.
const BUMP_DEPTH = 0.3;
// How far back the back layer of images sits, between NEAR (0) and FAR (1).
const BACK_DEPTH = 0.55;
// Resting look and speed (px/s), from nearest column to furthest back.
// The spread is wide so the stream reads as layers: near images are big,
// clearer and quick, far ones small, hazy and slow, and nearer columns sit
// in front where they overlap.
const NEAR = { blur: 32, opacity: 0.65, speed: 42, scale: 1.2 };
const FAR = { blur: 48, opacity: 0.25, speed: 15, scale: 0.6 };
// Moving the mouse shifts each column sideways by up to this much, more for
// nearer columns, for a little parallax.
const PARALLAX_PX = 28;
const PARALLAX_EASE_PER_S = 3;
// Soft copies are blurred by Sanity's image service, on a small copy
// SOFT_WIDTH_PX wide inside SOFT_PAD_PX of clear padding the blur feathers
// out into, rather than live with CSS (too heavy for Chrome on moving
// images). Blur strength (in Sanity's units) comes from the depth: see
// NEAR and FAR.
const SOFT_WIDTH_PX = 160;
const SOFT_PAD_PX = 24;
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
// "See the project" comes up in the middle of a image in focus, after a
// pause, so a passing mouse just sees the image and the label only appears
// once you've settled on it.
const LABEL_DELAY_MS = 650;
const LABEL_IN_MS = 900;
const LABEL_CLASS =
  'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-front/15 bg-grey-600 px-3.5 py-2 font-body text-[0.9375rem] leading-[1.2] text-front backdrop-blur-[14px] whitespace-nowrap pointer-events-none';
// No image is smaller than one that fits the label with this much room
// all round it.
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
  image: HeroPopUpImage;
  /** Position (x from the column's left edge) and velocity, in px and px/s. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Where it drifts back to sideways, from the column's left edge. */
  home: number;
  w: number;
  h: number;
  gap: number;
  sway: number;
  swayRate: number;
  swayPhase: number;
  focused: boolean;
}

interface Column {
  el: HTMLElement;
  /** The column's twin in the front layer, where a image in focus moves. */
  front: HTMLElement;
  items: Item[];
  depth: number;
  speed: number;
  speedNow: number;
  centre: number;
  w: number;
  hovered: number;
  shift: number;
  /** Sway clock: runs with the column, so a stopped column stops swaying
   * (an image in focus holds still rather than sliding from under you). */
  time: number;
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

  function ratio(image: HeroPopUpImage) {
    return clamp(image.aspectRatio || 4 / 3, 0.7, 1.6);
  }

  function softUrl(image: HeroPopUpImage, blur: number) {
    const softH = Math.round(SOFT_WIDTH_PX / ratio(image));
    return (
      `${image.url.split('?')[0]}?w=${SOFT_WIDTH_PX + SOFT_PAD_PX * 2}&h=${softH + SOFT_PAD_PX * 2}` +
      `&fit=crop&pad=${SOFT_PAD_PX}&bg=00F9F7F2&blur=${blur}&fm=webp&q=70`
    );
  }

  // Sets (or swaps) the image an item shows, with its own size, sideways
  // drift and gap, all varied around the column's width.
  function fill(item: Item, image: HeroPopUpImage, col: Column) {
    // Never smaller than fits the label with room around it.
    const w = Math.max(col.w * between(ITEM_WIDTH_RANGE), minWidth, minHeight * ratio(image));
    const h = w / ratio(image);
    const x = (col.w - w) / 2 + (Math.random() * 2 - 1) * col.w * ITEM_DRIFT_SHARE;
    const scale = w / SOFT_WIDTH_PX;
    const softH = Math.round(SOFT_WIDTH_PX / ratio(image));
    item.image = image;
    item.w = w;
    item.h = h;
    // Gaps scale with the image itself, so small screens (where images sit
    // at their minimum size in narrow columns) aren't packed tight.
    item.gap = h * between(IMAGE_GAP_RANGE);
    item.sway = col.w * SWAY_SHARE * between([0.4, 1]);
    item.swayRate = (Math.PI * 2) / between(SWAY_PERIOD_S);
    item.swayPhase = Math.random() * Math.PI * 2;
    item.home = item.x = x;
    item.vx = 0;
    item.vy = -col.speedNow;
    item.wrap.style.width = `${w}px`;
    item.wrap.style.height = `${h}px`;
    // The soft copy's blur spreads past the image, so it's left out of
    // hit-testing: only the image itself reacts to the mouse.
    item.soft.src = softUrl(image, Math.round(look(col.depth).blur));
    item.soft.style.cssText =
      `position:absolute;display:block;max-width:none;pointer-events:none;` +
      `left:${-SOFT_PAD_PX * scale}px;top:${-SOFT_PAD_PX * scale}px;` +
      `width:${(SOFT_WIDTH_PX + SOFT_PAD_PX * 2) * scale}px;height:${(softH + SOFT_PAD_PX * 2) * scale}px`;
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
    // the image.
    const label = document.createElement('span');
    label.textContent = 'See the project';
    label.className = LABEL_CLASS;
    label.style.opacity = '0';
    soft.alt = '';
    soft.decoding = 'async';
    sharp.decoding = 'async';
    wrap.style.cssText = `position:absolute;left:0;top:0;display:block;border-radius:8px;pointer-events:auto;will-change:transform;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none`;
    card.style.cssText = `position:relative;width:100%;height:100%;opacity:${look(col.depth).opacity}`;
    sharp.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;opacity:0;max-width:none';
    sharp.draggable = false;
    soft.draggable = false;
    card.append(soft, sharp, label);
    wrap.append(card);
    const item: Item = { wrap, card, soft, sharp, label, image: images[0], x: 0, y: 0, vx: 0, vy: 0, home: 0, w: 0, h: 0, gap: 0, sway: 0, swayRate: 0, swayPhase: 0, focused: false };
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
    probe.textContent = 'See the project';
    probe.style.visibility = 'hidden';
    layer.append(probe);
    const { width, height } = probe.getBoundingClientRect();
    probe.remove();
    minWidth = width + LABEL_CLEARANCE_PX * 2;
    minHeight = height + LABEL_CLEARANCE_PX * 2;
  }

  function build() {
    touchFocused = touchCol = null;
    layer.replaceChildren();
    measureLabel();
    frontLayer.replaceChildren();
    columns = [];
    width = layer.clientWidth;
    const height = layer.clientHeight;
    if (!width || !height) return;
    const count = clamp(Math.round(width / COLUMN_PITCH_PX), MIN_COLUMNS, MAX_COLUMNS);
    const pitch = width / count;
    // Two layers, near and back, shared out evenly and shuffled across the
    // columns, with a little randomness within each. The back layer sits
    // part-way to FAR rather than all the way, so nothing ends up tiny and
    // very hazy.
    const depths = Array.from({ length: count }, (_, i) =>
      clamp((i % 2 ? BACK_DEPTH : 0) + (Math.random() * 2 - 1) * 0.05, 0, 1)
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
      const col: Column = { el, front, items: [], depth, speed, speedNow: reduceMotion ? 0 : speed, centre, w, hovered: 0, shift: 0, time: Math.random() * 100 };
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
      const gone = col.items.find((item) => !item.focused && item.y + item.h < -height * 0.15);
      if (gone) {
        const lowest = Math.max(...col.items.filter((item) => item !== gone).map((item) => item.y + item.h + item.gap), 0);
        col.items.splice(col.items.indexOf(gone), 1);
        fill(gone, draw(), col);
        gone.y = Math.max(lowest, height * 1.05);
        col.items.push(gone);
      }
      for (const item of col.items) item.wrap.style.transform = `translate3d(${item.x}px, ${item.y}px, 0)`;
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
      if (col.speed) col.time += dt * (col.speedNow / col.speed);
      if (!reduceMotion) {
        const shiftTarget = -pointerX * PARALLAX_PX * (1 - col.depth * 0.85);
        col.shift += (shiftTarget - col.shift) * Math.min(1, dt * PARALLAX_EASE_PER_S);
      }
    }
    if (dt) move(dt);
    place();
    schedule();
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
        item.vy += (-col.speedNow - item.vy) * Math.min(1, dt * RISE_EASE_PER_S);
        const lineX = item.home + Math.sin(col.time * item.swayRate + item.swayPhase) * item.sway;
        item.vx += (lineX - item.x) * HOME_SPRING * dt;
        item.vx *= Math.exp(-SIDE_DAMPING_PER_S * dt);
        item.x += item.vx * dt;
        item.y += item.vy * dt;
      }
    }
    // Every pair, as boxes with BUMP_GAP_PX kept between them: pushed apart
    // along whichever way they overlap least, and their speeds along that
    // way exchanged with some bounce. An image in focus doesn't budge
    // (the others bounce off it). Heavier (bigger) images push harder.
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      const al = a.left + a.item.x;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (a.item.focused && b.item.focused) continue;
        if (Math.abs(a.col.depth - b.col.depth) > BUMP_DEPTH) continue;
        const bl = b.left + b.item.x;
        const ox = Math.min(al + a.item.w, bl + b.item.w) - Math.max(al, bl) + BUMP_GAP_PX;
        if (ox <= 0) continue;
        const oy = Math.min(a.item.y + a.item.h, b.item.y + b.item.h) - Math.max(a.item.y, b.item.y) + BUMP_GAP_PX;
        if (oy <= 0) continue;
        const ia = a.item.focused ? 0 : 1 / (a.item.w * a.item.h);
        const ib = b.item.focused ? 0 : 1 / (b.item.w * b.item.h);
        const share = ia + ib;
        if (!share) continue;
        const horizontal = ox < oy;
        // Which way b sits from a, along that axis.
        const dir = horizontal
          ? Math.sign(bl + b.item.w / 2 - (al + a.item.w / 2)) || 1
          : Math.sign(b.item.y + b.item.h / 2 - (a.item.y + a.item.h / 2)) || 1;
        const push = (horizontal ? ox : oy) * 0.5;
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
  document.fonts?.ready.then(measureLabel);
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
      frontLayer.style.opacity = layer.style.opacity;
      frontLayer.style.visibility = layer.style.visibility;
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

