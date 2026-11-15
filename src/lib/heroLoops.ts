/** The hero's background videos (set in Studio under Hero → Background
 * videos): they fill the first screen one at a time, in order. Each plays
 * through twice, then the next pushes it off sideways, the two sliding
 * together with an ease in and out, and after the last it comes back round
 * to the first.
 *
 * The <video> elements are rendered by Hero.astro, stacked in `root`; only
 * the first one loads up front, and each one after it starts loading while
 * the one before is playing, so it's ready by the time it's needed. */

// How many times each video plays before moving on.
const PLAYS = 2;
// The push between videos.
const PUSH_MS = 1400;
const PUSH_EASE = 'cubic-bezier(0.65, 0, 0.35, 1)';
// The push sets off this long before the video's second play ends, so it
// is still moving as it slides away rather than stopped on its last frame.
const PUSH_LEAD_S = 0.6;
// How long to wait for the next video to be ready before pushing anyway.
const READY_WAIT_MS = 4000;

export function initHeroLoops(root: HTMLElement, reduceMotion: boolean) {
  const videos = Array.from(root.querySelectorAll<HTMLVideoElement>('video'));
  let index = 0;
  let plays = 0;
  let lastTime = 0;
  let pushing = false;
  let paused = false;

  const play = (video: HTMLVideoElement) => video.play().catch(() => {});

  const preload = (video: HTMLVideoElement) => {
    if (video.readyState > 0 || video.preload === 'auto') return;
    video.preload = 'auto';
    video.load();
  };

  const whenReady = (video: HTMLVideoElement) =>
    new Promise<void>((resolve) => {
      if (video.readyState >= 3) return resolve();
      const done = () => {
        video.removeEventListener('canplay', done);
        window.clearTimeout(timer);
        resolve();
      };
      const timer = window.setTimeout(done, READY_WAIT_MS);
      video.addEventListener('canplay', done);
    });

  function start(video: HTMLVideoElement) {
    plays = 0;
    lastTime = 0;
    // Loops by itself until its last play, so the restart is seamless.
    video.loop = videos.length === 1 || PLAYS > 1;
    if (videos.length > 1) preload(videos[(index + 1) % videos.length]);
  }

  async function push() {
    if (pushing || videos.length < 2) return;
    pushing = true;
    const current = videos[index];
    const nextIndex = (index + 1) % videos.length;
    const next = videos[nextIndex];
    preload(next);
    await whenReady(next);
    next.currentTime = 0;
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
    index = nextIndex;
    start(next);
    pushing = false;
  }

  // Counts the plays (a loop shows up as the time jumping back), lets the
  // last one run out rather than loop, and sets the push off just before
  // it ends. Driven by the video's own time updates (a few a second), which
  // carry on even where animation frames are held back.
  function onTime(this: HTMLVideoElement) {
    const video = this;
    if (video !== videos[index] || pushing || !video.duration) return;
    if (video.currentTime < lastTime - 0.25) {
      plays++;
      if (plays >= PLAYS - 1 && videos.length > 1) video.loop = false;
    }
    lastTime = video.currentTime;
    if (videos.length > 1 && plays >= PLAYS - 1 && video.duration - video.currentTime <= PUSH_LEAD_S) push();
  }

  for (const video of videos) {
    video.addEventListener('timeupdate', onTime);
    // In case the end comes between time updates.
    video.addEventListener('ended', () => {
      if (video === videos[index]) push();
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
      const showing = videos.filter((v) => v.style.visibility !== 'hidden');
      if (paused) showing.forEach((v) => v.pause());
      else showing.forEach(play);
    },
  };
}
