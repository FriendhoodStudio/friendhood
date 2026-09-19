export interface PageLink {
  label: string;
  href: string;
}

export type ContactLink =
  | { label: string; linkType: 'email'; email: string }
  | { label: string; linkType: 'link'; href: string };

export interface NavMenuData {
  pageLinks: PageLink[];
  contactLinks: ContactLink[];
}
