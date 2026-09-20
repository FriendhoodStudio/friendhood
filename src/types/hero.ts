import type { Media } from './media';

export interface HeroData {
  headline: string;
  headlineSwapWord?: string;
  headlineHoverWords?: string[];
  tagline: string;
  media: Media;
  /** Full showreel, played with sound in the "Watch our showreel" modal — a
   * separate file from `media`'s short muted loop. Undefined until one is
   * uploaded in Studio, which is also what gates the trigger button. */
  reelVideoUrl?: string;
}
