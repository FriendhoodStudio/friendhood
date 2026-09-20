import type { Media } from './media';

export interface Category {
  title: string;
  slug: string;
}

export type ProjectMedia = Media;

export interface ProjectCardData {
  id: string;
  slug: string;
  title: string;
  detail: string;
  categories: Category[];
  media?: ProjectMedia;
  href: string;
  /** Shows a "Coming soon" placeholder over the card image and disables click-through. */
  comingSoon: boolean;
}
