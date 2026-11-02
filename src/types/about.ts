import type { CarouselImageItem } from './carousel';
import type { SeoData } from './seo';

export interface ApproachCard {
  title: string;
  text: string;
  imageUrl: string;
  imageAlt: string;
}

export interface AboutData {
  introLabel: string;
  introHeading: string;
  introImages: CarouselImageItem[];
  servicesLabel: string;
  servicesHeading: string;
  approachLabel: string;
  approachHeading: string;
  approachCards: ApproachCard[];
  clientsLabel: string;
  clients: string[];
  seo?: SeoData;
}
