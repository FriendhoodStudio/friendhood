import type { Category, ProjectCardData } from './project';

export type CaseStudyMediaItem = { type: 'image'; url: string } | { type: 'video'; url: string };

export interface CaseStudyMediaBlock {
  type: 'media';
  items: CaseStudyMediaItem[];
}

export interface CaseStudyOverviewBlock {
  type: 'overview';
  label: string;
  text: string;
}

export interface CaseStudyParagraphBlock {
  type: 'paragraph';
  label: string;
  text: string;
}

export type CaseStudyBlock = CaseStudyMediaBlock | CaseStudyOverviewBlock | CaseStudyParagraphBlock;

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
  categories: Category[];
  body: CaseStudyBlock[];
  footer: CaseStudyFooter;
  relatedProjects: ProjectCardData[];
}
