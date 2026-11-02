import type { SeoData } from './seo';

export interface SiteSettingsData {
  faviconUrl: string;
  /** Larger square render of the same favicon image, used as the logo in
   * structured data (Google wants at least 112×112). */
  logoUrl: string;
  title: string;
  description: string;
  ogImageUrl?: string;
  homeSeo?: SeoData;
  socialProfiles: string[];
}
