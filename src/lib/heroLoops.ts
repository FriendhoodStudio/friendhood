/** The hero's background videos (set in Studio under Hero → Background
 * videos): they fill the first screen one at a time, in order, each looping
 * until the headline's word changes (see Hero.astro), when the next pushes
 * it off sideways, the two sliding together with an ease in and out. After
 * the last it comes back round to the first.
 *
 * The <video> elements are rendered by Hero.astro, stacked in `root`; only
 * the first one loads up front, and each one after it is loaded while the
 * one before is playing (see warm), so it's ready by the time it's needed. */

// The push between videos.
const PUSH_MS = 1400;
const PUSH_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';

export function initHeroLoops(root: HTMLElement, reduceMotion: boolean) {
  const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video'));
  let index = 0;
  let pushing = false;
  // A change asked for while a push is still sliding, made once it lands.
  let queued = false;
  let paused = false;
  const listeners: ((index: number) => void)[] = [];

  // Phones can refuse to autoplay even muted video (an iPhone in Low Power
  // Mode always does). When a play is refused, the videos start instead on
  // the first touch, click, key or scroll, which counts as permission.
  let waitingForGesture = false;
  const showing = () => videos.filter((v) => v.style.visibility !== 'hidden');
  const GESTURES = ['touchstart', 'pointerdown', 'keydown', 'scroll'] as const;
  function onGesture() {
    GESTURES.forEach((type) => window.removeEventListener(type, onGesture));
    waitingForGesture = false;
    if (!paused) showing().forEach(play);
    // A phone that wanted a tap before playing wants one before loading the
    // next video too (see warm), and this is it.
    if (videos.length > 1) warm(nextVideo());
  }
  function play(video: HTMLVideoElement) {
    video.muted = true;
    video.play().catch(() => {
      if (waitingForGesture) return;
      waitingForGesture = true;
      GESTURES.forEach((type) => window.addEventListener(type, onGesture, { passive: true }));
    });
  }
  // Coming back to the tab (or the app) after the browser paused it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !paused) showing().forEach(play);
  });

  // Gets a video loaded and sitting on its first frame, ready to push in.
  // Phones (an iPhone especially) ignore a request to preload and only load
  // a video once it's played, so it's played for a moment and paused.
  const warming = new WeakSet<HTMLVideoElement>();
  function warm(video: HTMLVideoElement) {
    if (video.readyState >= 3 || warming.has(video)) return;
    warming.add(video);
    video.preload = 'auto';
    if (video.networkState === HTMLMediaElement.NETWORK_EMPTY) video.load();
    video.muted = true;
    video
      .play()
      .then(() => {
        if (video !== videos[index] && !pushing) {
          video.pause();
          video.currentTime = 0;
        }
      })
      .catch(() => {})
      .finally(() => warming.delete(video));
  }

  function start(video: HTMLVideoElement) {
    // Loops by itself, so each restart is seamless, until it's pushed on.
    video.loop = true;
    if (videos.length > 1) warm(nextVideo());
  }

  const nextVideo = () => videos[(index + 1) % videos.length];

  async function push() {
    if (videos.length < 2) return;
    if (pushing) {
      queued = true;
      return;
    }
    pushing = true;
    const current = videos[index];
    const nextIndex = (index + 1) % videos.length;
    const next = videos[nextIndex];
    listeners.forEach((fn) => fn(nextIndex));
    // The outgoing video plays out its last moments as it slides away and
    // holds its last frame, rather than jumping back to its start.
    current.loop = false;
    if (next.currentTime > 0.05) next.currentTime = 0;
    next.loop = true;
    next.style.visibility = 'visible';
    if (!paused) play(next);
    const options: KeyframeAnimationOptions = { duration: PUSH_MS, easing: PUSH_EASE, fill: 'forwards' };
    const outgoing = reduceMotion
      ? current.animate([{ opacity: 1 }, { opacity: 0 }], options)
      : current.animate([{ translate: '0 0' }, { translate: '-100% 0' }], options);
    const incoming = reduceMotion
      ? next.animate([{ opacity: 0 }, { opacity: 1 }], options)
      : next.animate([{ translate: '100% 0' }, { translate: '0 0' }], options);
    await Promise.all([outgoing.finished, incoming.finished]).catch(() => {});
    outgoing.cancel();
    incoming.cancel();
    current.pause();
    current.style.visibility = 'hidden';
    if (current.currentTime > 0.05) current.currentTime = 0;
    index = nextIndex;
    pushing = false;
    start(next);
    if (queued) {
      queued = false;
      push();
    }
  }

  videos.forEach((video, i) => {
    video.style.visibility = i === 0 ? 'visible' : 'hidden';
  });
  if (videos[0]) {
    start(videos[0]);
    play(videos[0]);
  }

  return {
    /** Pushes on to the next video. */
    next: push,
    /** Which video is showing (or on its way in). */
    get index() {
      return index;
    },
    /** Called with the incoming video's index as each push sets off. */
    onChange(fn: (index: number) => void) {
      listeners.push(fn);
    },
    /** Stops the videos while they're scrolled out of sight, and picks
     * them back up where they were. */
    setPaused(value: boolean) {
      if (value === paused || !videos.length) return;
      paused = value;
      if (paused) showing().forEach((v) => v.pause());
      else showing().forEach(play);
    },
  };
}
