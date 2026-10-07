import type { Media } from './media';

export interface HeroData {
  headline: string;
  headlineSwapWord?: string;
  headlineHoverWords?: string[];
  tagline: string;
  media: Media;
  /** Optional 4:5 portrait crop of `media`'s video, swapped in on mobile in
   * place of the automatic CSS crop of the 16:9 source. Only meaningful
   * when `media.type === 'video'`; undefined falls back to the CSS crop. */
  heroVideoMobileUrl?: string;
  /** Full showreel, played with sound in the "Watch our showreel" modal — a
   * separate file from `media`'s short muted loop. Undefined until one is
   * uploaded in Studio, which is also what gates the trigger button. */
  reelVideoUrl?: string;
}
