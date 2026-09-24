import type { CarouselImageItem } from './carousel';

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
}
