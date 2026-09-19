export type Media =
  | { type: 'image'; url: string; alt: string }
  | { type: 'video'; url: string; posterUrl?: string; alt: string };
