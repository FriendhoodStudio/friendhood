import type { Media } from './media';

export interface HeroData {
  headline: string;
  headlineSwapWord?: string;
  headlineHoverWords?: string[];
  tagline: string;
  media: Media;
}
