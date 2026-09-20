import type { Category, ProjectCardData } from './project';
import type { CarouselImageItem } from './carousel';

export type CaseStudyMediaItem = { type: 'image'; url: string; alt: string } | { type: 'video'; url: string };

export interface CaseStudyMediaBlock {
  type: 'media';
  items: CaseStudyMediaItem[];
}

export interface CaseStudyParagraphBlock {
  type: 'paragraph';
  label: string;
  text: string;
}

export interface CaseStudyCarouselBlock {
  type: 'carousel';
  images: CarouselImageItem[];
}

export type CaseStudyBlock = CaseStudyMediaBlock | CaseStudyParagraphBlock | CaseStudyCarouselBlock;

export interface CaseStudyOverview {
  label: string;
  text: string;
}

export interface ImpactStat {
  value: string;
  label: string;
}

export interface Collaborator {
  role: string;
  name: string;
}

export interface CaseStudyQuote {
  text: string;
  attributionName: string;
  attributionCompany?: string;
}

export interface CaseStudyFooter {
  showImpact: boolean;
  impactStats: ImpactStat[];
  showCollaborators: boolean;
  collaborators: Collaborator[];
  showQuote: boolean;
  quote?: CaseStudyQuote;
}

export interface CaseStudyData {
  title: string;
  slug: string;
  openingStatement: string;
  heroImageUrl: string;
  heroImageAlt: string;
  overview?: CaseStudyOverview;
  categories: Category[];
  body: CaseStudyBlock[];
  footer: CaseStudyFooter;
  relatedProjects: ProjectCardData[];
}
