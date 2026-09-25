import { createImageUrlBuilder, type SanityImageSource } from '@sanity/image-url';
import type { Category, ProjectCardData } from '../../types/project';
import type { Media } from '../../types/media';
import type { HeroData } from '../../types/hero';
import type { ServiceItem, ServicesData } from '../../types/services';
import type { LogoItem, LogoCarouselData } from '../../types/logoCarousel';
import type { LinkCardItem, LinkCardsData } from '../../types/linkCards';
import type { CaseStudyBlock, CaseStudyData, CaseStudyMediaItem } from '../../types/caseStudy';
import type { ApproachCard, AboutData } from '../../types/about';
import type { CarouselImageItem } from '../../types/carousel';
import type { SiteSettingsData } from '../../types/siteSettings';

const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production';

const builder = createImageUrlBuilder({ projectId, dataset });

function urlFor(source: SanityImageSource) {
  // .auto('format') lets Sanity's CDN serve WebP/AVIF to browsers that
  // support it (falling back to the original format otherwise) — applied
  // once here so every image call site gets it, including ones already
  // uploaded, with no re-encoding or re-upload needed.
  return builder.image(source).auto('format');
}

// A shared width scale rather than each call site picking its own ad-hoc
// number (previously: 900, 1100, 1200, 1670, 2200 — five near-arbitrary
// values across nine call sites, several of them within ~10% of each other
// for no real reason). Every image request below maps to the nearest of
// these four:
//   sm — small tiles/avatars (Services' 63px circle + its own bigger detail
//        card reuse the same source, sm covers both)
//   md — the common portrait card/thumbnail size (project cards, About's
//        approach cards, link cards, carousel narrow, hero preview media)
//   lg — case study body media (full-width and the 2-up side-by-side slot
//        share one code path, so this covers both; already 2x+ the 2-up
//        slot's real display width)
//   xl — slots with the most headroom to fill: carousel wide images, and
//        the case study hero specifically (unlike body media, its full-width
//        slot has no page max-width, so it's the one place a very wide
//        desktop monitor can render past what `lg` would deliver)
// Consolidating onto four shared values also means Sanity's CDN can reuse
// the same cached derivative across different images/components requesting
// the same bucket, instead of generating a distinct one per ad-hoc number.
const IMAGE_WIDTH = {
  sm: 900,
  md: 1200,
  lg: 1700,
  xl: 2400,
} as const;

export interface RawMedia {
  mediaType: 'image' | 'video';
  heroImage?: SanityImageSource;
  heroVideoUrl?: string;
  videoPoster?: SanityImageSource;
}

function toMedia(raw: RawMedia, alt: string): Media {
  if (raw.mediaType === 'video' && raw.heroVideoUrl) {
    return {
      type: 'video',
      url: raw.heroVideoUrl,
      posterUrl: raw.videoPoster ? urlFor(raw.videoPoster).width(IMAGE_WIDTH.md).fit('max').url() : undefined,
      alt,
    };
  }
  return {
    type: 'image',
    url: urlFor(raw.heroImage!).width(IMAGE_WIDTH.md).fit('max').url(),
    alt,
  };
}

export interface RawProject {
  _id: string;
  title: string;
  slug: string;
  detail: string;
  categories: Category[];
  comingSoon?: boolean;
  // Home/Work grid thumbnail media — distinct from the case study's own heroImage below.
  // Not required (and possibly unset) while comingSoon is true — see below.
  cardMediaType: 'image' | 'video';
  cardImage?: SanityImageSource;
  cardVideoUrl?: string;
  cardVideoPoster?: SanityImageSource;
}

export function toProjectCardData(raw: RawProject): ProjectCardData {
  return {
    id: raw._id,
    slug: raw.slug,
    title: raw.title,
    detail: raw.detail,
    categories: raw.categories,
    // "Coming soon" is an overlay on top of the card media, not a
    // replacement for it — the image/video still renders underneath.
    media: toMedia(
      {
        mediaType: raw.cardMediaType,
        heroImage: raw.cardImage,
        heroVideoUrl: raw.cardVideoUrl,
        videoPoster: raw.cardVideoPoster,
      },
      raw.title
    ),
    href: `/work/${raw.slug}`,
    comingSoon: raw.comingSoon ?? false,
  };
}

export function toProjectCardDataList(rawList: RawProject[]): ProjectCardData[] {
  return rawList.map(toProjectCardData);
}

export interface RawCaseStudyMediaItem {
  _type: 'image' | 'file';
  asset?: SanityImageSource;
  alt?: string;
  videoUrl?: string;
}

export interface RawCaseStudyMediaBlock {
  _type: 'mediaBlock';
  items: RawCaseStudyMediaItem[];
}

export interface RawCaseStudyParagraphBlock {
  _type: 'paragraphBlock';
  label: string;
  text: string;
}

export interface RawCaseStudyCarouselBlock {
  _type: 'carouselBlock';
  images: RawCarouselImage[];
}

export type RawCaseStudyBlock = RawCaseStudyMediaBlock | RawCaseStudyParagraphBlock | RawCaseStudyCarouselBlock;

export interface RawCaseStudyFooter {
  showImpact?: boolean;
  impactStats?: { value: string; label: string }[];
  showCollaborators?: boolean;
  collaborators?: { role: string; name: string }[];
  showQuote?: boolean;
  quote?: { text: string; attributionName: string; attributionCompany?: string };
}

export interface RawCaseStudy {
  title: string;
  slug: string;
  openingStatement: string;
  heroImage: SanityImageSource & { alt?: string };
  overview?: { label: string; text: string };
  categories: Category[];
  body?: RawCaseStudyBlock[];
  footer?: RawCaseStudyFooter;
  relatedProjects?: RawProject[];
}

export function toCaseStudyData(raw: RawCaseStudy): CaseStudyData {
  return {
    title: raw.title,
    slug: raw.slug,
    openingStatement: raw.openingStatement,
    // xl, not lg — unlike the body media below, this full-width slot has no
    // page max-width, so it's the one place a very wide desktop monitor can
    // render past what lg would deliver without the browser upscaling.
    heroImageUrl: urlFor(raw.heroImage).width(IMAGE_WIDTH.xl).fit('max').url(),
    // Falls back to a generic-but-non-empty description when an editor
    // hasn't filled in the Alt text field yet (e.g. every case study
    // created before that field existed) — never render an empty alt on
    // real content imagery, but let Studio-authored text take priority.
    heroImageAlt: raw.heroImage.alt || `${raw.title} case study hero image`,
    overview: raw.overview,
    categories: raw.categories,
    body: (raw.body ?? [])
      .map((block): CaseStudyBlock | null => {
        if (block._type === 'mediaBlock') {
          // In the dev-preview (drafts) perspective, a media item can be a
          // freshly-added array entry that doesn't have an image/video
          // uploaded into it yet — a completely normal mid-edit state in
          // Studio, not something to crash the page over. Incomplete items
          // are skipped; a block left with none is dropped entirely rather
          // than rendering an empty row.
          const items = block.items
            .filter((item) => (item._type === 'file' ? !!item.videoUrl : !!item.asset))
            .map(
              (item): CaseStudyMediaItem =>
                item._type === 'file'
                  ? { type: 'video', url: item.videoUrl! }
                  : {
                      type: 'image',
                      url: urlFor(item.asset!).width(IMAGE_WIDTH.lg).fit('max').url(),
                      alt: item.alt || `${raw.title} project image`,
                    }
            );
          return items.length > 0 ? { type: 'media', items } : null;
        }
        if (block._type === 'carouselBlock') {
          // Same incomplete-mid-edit-draft tolerance as the media block
          // above — a freshly-added array entry with no image uploaded yet
          // is dropped rather than crashing the page.
          const images = (block.images ?? [])
            .filter((item) => !!item.image?.asset)
            .map(
              (item): CarouselImageItem => ({
                url: urlFor(item.image)
                  .width(item.wide ? 2200 : 1200)
                  .fit('max')
                  .url(),
                alt: item.image.asset?.altText || `${raw.title} project image`,
                wide: item.wide,
              })
            );
          return images.length > 0 ? { type: 'carousel', images } : null;
        }
        return { type: 'paragraph', label: block.label, text: block.text };
      })
      .filter((block): block is CaseStudyBlock => block !== null),
    footer: {
      showImpact: raw.footer?.showImpact ?? false,
      impactStats: raw.footer?.impactStats ?? [],
      showCollaborators: raw.footer?.showCollaborators ?? false,
      collaborators: raw.footer?.collaborators ?? [],
      showQuote: raw.footer?.showQuote ?? false,
      quote: raw.footer?.quote,
    },
    relatedProjects: toProjectCardDataList(raw.relatedProjects ?? []),
  };
}

export interface RawHero extends RawMedia {
  headline: string;
  headlineSwapWord?: string;
  headlineHoverWords?: string[];
  tagline: string;
  reelVideoUrl?: string;
}

export function toHeroData(raw: RawHero): HeroData {
  return {
    headline: raw.headline,
    headlineSwapWord: raw.headlineSwapWord,
    headlineHoverWords: raw.headlineHoverWords,
    tagline: raw.tagline,
    media: toMedia(raw, raw.headline),
    reelVideoUrl: raw.reelVideoUrl,
  };
}

export interface RawServiceItem {
  name: string;
  cardTitle: string;
  image: SanityImageSource;
  overview: string;
  modules: string[];
}

export interface RawServices {
  descriptor: string;
  paragraph: string;
  services: RawServiceItem[];
}

export function toServicesData(raw: RawServices): ServicesData {
  return {
    descriptor: raw.descriptor,
    paragraph: raw.paragraph,
    services: raw.services.map(
      (item): ServiceItem => ({
        name: item.name,
        cardTitle: item.cardTitle,
        imageUrl: urlFor(item.image).width(IMAGE_WIDTH.sm).fit('max').url(),
        overview: item.overview,
        modules: item.modules,
      })
    ),
  };
}

export interface RawLogoItem {
  name: string;
  logo: SanityImageSource;
}

export interface RawLogoCarousel {
  logos: RawLogoItem[];
}

export function toLogoCarouselData(raw: RawLogoCarousel): LogoCarouselData {
  return {
    logos: raw.logos.map(
      (item): LogoItem => ({
        name: item.name,
        // Height-constrained, not width — logos sit in a fixed-height strip
        // at varying natural widths, the opposite of every other image here,
        // so it doesn't belong in the IMAGE_WIDTH scale above.
        logoUrl: urlFor(item.logo).height(220).fit('max').url(),
      })
    ),
  };
}

export interface RawLinkCardItem {
  label: string;
  image: SanityImageSource;
  href: string;
}

export interface RawLinkCards {
  cards: RawLinkCardItem[];
}

export function toLinkCardsData(raw: RawLinkCards): LinkCardsData {
  return {
    cards: raw.cards.map(
      (item): LinkCardItem => ({
        label: item.label,
        imageUrl: urlFor(item.image).width(IMAGE_WIDTH.md).fit('max').url(),
        href: item.href,
      })
    ),
  };
}

export interface RawApproachCard {
  title: string;
  text: string;
  image: SanityImageSource & { alt?: string };
}

export interface RawCarouselImage {
  _key: string;
  // The GROQ projection dereferences `asset` (`asset->`) so `altText` — set
  // once on the asset itself, e.g. in the Media Library, or wherever this
  // same image was first uploaded elsewhere on the site — comes along with
  // it, rather than needing its own per-usage alt field.
  image: SanityImageSource & { asset?: { altText?: string } };
  wide: boolean;
}

export interface RawAbout {
  introLabel: string;
  introHeading: string;
  introImages: RawCarouselImage[];
  servicesLabel: string;
  servicesHeading: string;
  approachLabel: string;
  approachHeading: string;
  approachCards: RawApproachCard[];
  clientsLabel: string;
  clients: string[];
}

export function toAboutData(raw: RawAbout): AboutData {
  return {
    introLabel: raw.introLabel,
    introHeading: raw.introHeading,
    // Same incomplete-mid-edit-draft tolerance as the case-study carousel
    // block below — a freshly-added array entry with no image uploaded yet
    // is dropped rather than crashing the whole site build.
    introImages: raw.introImages
      .filter((item) => !!item.image?.asset)
      .map(
        (item): CarouselImageItem => ({
          url: urlFor(item.image)
            .width(item.wide ? IMAGE_WIDTH.xl : IMAGE_WIDTH.md)
            .fit('max')
            .url(),
          alt: item.image.asset?.altText || 'Friendhood',
          wide: item.wide,
        })
      ),
    servicesLabel: raw.servicesLabel,
    servicesHeading: raw.servicesHeading,
    approachLabel: raw.approachLabel,
    approachHeading: raw.approachHeading,
    approachCards: raw.approachCards.map(
      (card): ApproachCard => ({
        title: card.title,
        text: card.text,
        imageUrl: urlFor(card.image).width(IMAGE_WIDTH.md).fit('max').url(),
        imageAlt: card.image.alt || card.title,
      })
    ),
    clientsLabel: raw.clientsLabel,
    clients: raw.clients,
  };
}

export interface RawSiteSettings {
  favicon: SanityImageSource;
  title: string;
  description: string;
  ogImage?: SanityImageSource;
}

export function toSiteSettingsData(raw: RawSiteSettings): SiteSettingsData {
  return {
    // Square crop regardless of the source image's own aspect ratio — a
    // browser tab icon has no room to letterbox. 180px covers the highest-
    // density case any consumer actually requests (Apple's touch-icon size);
    // browsers needing a literal 16/32px favicon downscale it themselves.
    faviconUrl: urlFor(raw.favicon).width(180).height(180).fit('crop').url(),
    title: raw.title,
    description: raw.description,
    ogImageUrl: raw.ogImage
      ? urlFor(raw.ogImage).width(IMAGE_WIDTH.md).fit('max').url()
      : undefined,
  };
}
