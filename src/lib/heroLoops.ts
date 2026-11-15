/** The hero's background videos (set in Studio under Hero → Background
 * videos): they fill the first screen one at a time, in order. Each plays
 * through twice (or for 12 seconds, if that's sooner), then the next pushes
 * it off sideways, the two sliding
 * together with an ease in and out, and after the last it comes back round
 * to the first.
 *
 * The <video> elements are rendered by Hero.astro, stacked in `root`; only
 * the first one loads up front, and each one after it is loaded while the
 * one before is playing (see warm), so it's ready by the time it's needed.
 * Nothing moves on until it is: the video showing just carries on looping. */

// How many times each video plays before moving on, and the most time
// (seconds) one stays on screen: a long clip moves on partway through
// rather than holding the screen for two full plays.
const PLAYS = 2;
const MAX_SHOWN_S = 12;
// The push between videos.
const PUSH_MS = 1400;
const PUSH_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
// The push sets off this long before the video's second play ends, so it
// is still moving as it slides away rather than stopped on its last frame.
const PUSH_LEAD_S = 0.6;

export function initHeroLoops(root: HTMLElement, reduceMotion: boolean) {
  const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video'));
  let index = 0;
  let plays = 0;
  let lastTime = 0;
  let pushing = false;
  let paused = false;

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
    plays = 0;
    lastTime = video.currentTime;
    // Loops by itself, so each restart is seamless; the push takes it from
    // there once it has played enough.
    video.loop = true;
    if (videos.length > 1) warm(videos[(index + 1) % videos.length]);
  }

  const nextVideo = () => videos[(index + 1) % videos.length];
  // Ready enough to play straight through the push without stalling.
  const isReady = (video: HTMLVideoElement) => video.readyState >= 3;

  async function push() {
    if (pushing || videos.length < 2) return;
    pushing = true;
    const current = videos[index];
    const nextIndex = (index + 1) % videos.length;
    const next = videos[nextIndex];
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
  }

  // Counts the plays (each loop shows up as the time jumping back) and sets
  // the push off just before the last one ends, once the next video is
  // ready. If it isn't ready yet, this one carries on looping and goes as
  // soon as it is, at the start of a loop; and if the moment near the end
  // was missed (time updates come only a few times a second, fewer on a
  // busy phone), it goes as the next loop starts. Driven by the video's own
  // time updates, which carry on even where animation frames are held back.
  function onTime(this: HTMLVideoElement) {
    const video = this;
    if (video !== videos[index] || pushing || !video.duration || videos.length < 2) return;
    const wrapped = video.currentTime < lastTime - 0.25;
    if (wrapped) plays++;
    lastTime = video.currentTime;
    const next = nextVideo();
    if (!isReady(next)) {
      if (plays >= PLAYS - 1) warm(next);
      return;
    }
    const nearEnd = plays >= PLAYS - 1 && video.duration - video.currentTime <= PUSH_LEAD_S;
    const overdue = plays >= PLAYS && video.currentTime < 1;
    const capped = plays * video.duration + video.currentTime >= MAX_SHOWN_S;
    if (nearEnd || overdue || capped) push();
  }

  for (const video of videos) {
    video.addEventListener('timeupdate', onTime);
    // In case the end comes between time updates.
    video.addEventListener('ended', () => {
      if (video === videos[index] && !pushing) push();
    });
  }

  videos.forEach((video, i) => {
    video.style.visibility = i === 0 ? 'visible' : 'hidden';
  });
  if (videos[0]) {
    start(videos[0]);
    play(videos[0]);
  }

  return {
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
