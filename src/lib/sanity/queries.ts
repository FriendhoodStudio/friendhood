import { sanityClient } from 'sanity:client';
import {
  toProjectCardDataList,
  toHeroData,
  toServicesData,
  toLogoCarouselData,
  toLinkCardsData,
  toCaseStudyData,
  toAboutData,
  type RawProject,
  type RawHero,
  type RawServices,
  type RawLogoCarousel,
  type RawLinkCards,
  type RawCaseStudy,
  type RawAbout,
} from './adapters';
import type { ProjectCardData } from '../../types/project';
import type { FooterData } from '../../types/footer';
import type { NavMenuData } from '../../types/navMenu';
import type { HeroData } from '../../types/hero';
import type { ServicesData } from '../../types/services';
import type { FeaturedWorkData } from '../../types/featuredWork';
import type { LogoCarouselData } from '../../types/logoCarousel';
import type { LinkCardsData } from '../../types/linkCards';
import type { CaseStudyData } from '../../types/caseStudy';
import type { AboutData } from '../../types/about';

// Dev-only: reads drafts-over-published (Sanity's `drafts` perspective
// resolves to the draft when one exists, falling back to published
// otherwise) so unpublished case-study content can be reviewed on the real
// page/layout instead of just Studio's raw field view — content only has to
// be re-verified once it's actually published, not twice. Needs a token
// since drafts aren't publicly readable; SANITY_API_TOKEN is server-only
// (no PUBLIC_ prefix), so it never reaches the client bundle, and this
// branch is dead code entirely in a production build (import.meta.env.DEV
// is statically false there, so the whole branch is tree-shaken out).
const previewClient =
  import.meta.env.DEV && import.meta.env.SANITY_API_TOKEN
    ? sanityClient.withConfig({
        perspective: 'drafts',
        token: import.meta.env.SANITY_API_TOKEN,
        useCdn: false,
      })
    : sanityClient;

const PROJECTS_QUERY = `*[_type == "project"] | order(orderRank asc) {
  _id,
  title,
  "slug": slug.current,
  detail,
  "categories": categories[]->{ title, "slug": slug.current },
  comingSoon,
  cardMediaType,
  cardImage,
  "cardVideoUrl": cardVideo.asset->url,
  cardVideoPoster
}`;

export async function fetchProjects(): Promise<ProjectCardData[]> {
  const raw = await previewClient.fetch<RawProject[]>(PROJECTS_QUERY);
  return toProjectCardDataList(raw);
}

const PROJECT_SLUGS_QUERY = `*[_type == "project"]{ "slug": slug.current }`;

export async function fetchProjectSlugs(): Promise<string[]> {
  // previewClient here too — a case study that only exists as a draft (not
  // yet published at all) still needs a route generated for it, or dev
  // preview could never reach its page regardless of what fetchCaseStudy does.
  const raw = await previewClient.fetch<{ slug: string }[]>(PROJECT_SLUGS_QUERY);
  return raw.map((item) => item.slug);
}

const CASE_STUDY_QUERY = `*[_type == "project" && slug.current == $slug][0]{
  title,
  "slug": slug.current,
  openingStatement,
  heroImage,
  overview,
  "categories": categories[]->{ title, "slug": slug.current },
  body[]{
    _type,
    items[]{
      _type,
      asset,
      alt,
      "videoUrl": asset->url
    },
    label,
    text,
    images[]{
      _key,
      "image": image{ ..., "asset": asset-> },
      wide
    }
  },
  footer,
  relatedProjects[]->{
    _id,
    title,
    "slug": slug.current,
    detail,
    "categories": categories[]->{ title, "slug": slug.current },
    comingSoon,
    cardMediaType,
    cardImage,
    "cardVideoUrl": cardVideo.asset->url,
    cardVideoPoster
  }
}`;

export async function fetchCaseStudy(slug: string): Promise<CaseStudyData | null> {
  const raw = await previewClient.fetch<RawCaseStudy | null>(CASE_STUDY_QUERY, { slug });
  return raw ? toCaseStudyData(raw) : null;
}

const FEATURED_PROJECTS_QUERY = `*[_type == "project" && featuredOnHome == true] | order(orderRank asc) {
  _id,
  title,
  "slug": slug.current,
  detail,
  "categories": categories[]->{ title, "slug": slug.current },
  comingSoon,
  cardMediaType,
  cardImage,
  "cardVideoUrl": cardVideo.asset->url,
  cardVideoPoster
}`;

export async function fetchFeaturedProjects(): Promise<ProjectCardData[]> {
  const raw = await previewClient.fetch<RawProject[]>(FEATURED_PROJECTS_QUERY);
  return toProjectCardDataList(raw);
}

const FOOTER_QUERY = `*[_type == "footer"][0]{ headline, links }`;

export async function fetchFooter(): Promise<FooterData | null> {
  return sanityClient.fetch<FooterData | null>(FOOTER_QUERY);
}

const NAV_MENU_QUERY = `*[_type == "navMenu"][0]{ pageLinks, contactLinks }`;

export async function fetchNavMenu(): Promise<NavMenuData | null> {
  return sanityClient.fetch<NavMenuData | null>(NAV_MENU_QUERY);
}

const HERO_QUERY = `*[_type == "hero"][0]{
  headline,
  headlineSwapWord,
  headlineHoverWords,
  tagline,
  mediaType,
  heroImage,
  "heroVideoUrl": heroVideo.asset->url,
  videoPoster,
  "reelVideoUrl": reelVideo.asset->url
}`;

export async function fetchHero(): Promise<HeroData | null> {
  const raw = await sanityClient.fetch<RawHero | null>(HERO_QUERY);
  return raw ? toHeroData(raw) : null;
}

const SERVICES_QUERY = `*[_type == "services"][0]{
  descriptor,
  paragraph,
  services[]{ name, cardTitle, image, overview, "modules": modules[]->title }
}`;

export async function fetchServices(): Promise<ServicesData | null> {
  const raw = await sanityClient.fetch<RawServices | null>(SERVICES_QUERY);
  return raw ? toServicesData(raw) : null;
}

const FEATURED_WORK_QUERY = `*[_type == "featuredWork"][0]{ descriptor, heading, buttonLabel, buttonHref }`;

export async function fetchFeaturedWork(): Promise<FeaturedWorkData | null> {
  return sanityClient.fetch<FeaturedWorkData | null>(FEATURED_WORK_QUERY);
}

const LOGO_CAROUSEL_QUERY = `*[_type == "logoCarousel"][0]{ logos[]{ name, logo } }`;

export async function fetchLogoCarousel(): Promise<LogoCarouselData | null> {
  const raw = await sanityClient.fetch<RawLogoCarousel | null>(LOGO_CAROUSEL_QUERY);
  return raw ? toLogoCarouselData(raw) : null;
}

const LINK_CARDS_QUERY = `*[_type == "linkCards"][0]{ cards[]{ label, image, href } }`;

export async function fetchLinkCards(): Promise<LinkCardsData | null> {
  const raw = await sanityClient.fetch<RawLinkCards | null>(LINK_CARDS_QUERY);
  return raw ? toLinkCardsData(raw) : null;
}

const ABOUT_QUERY = `*[_type == "about"][0]{
  introLabel,
  introLabelMuted,
  introHeading,
  introImages[]{
    _key,
    "image": image{ ..., "asset": asset-> },
    wide
  },
  servicesLabel,
  servicesHeading,
  approachLabel,
  approachHeading,
  approachCards[]{ title, text, image },
  clientsLabel,
  clients
}`;

export async function fetchAbout(): Promise<AboutData | null> {
  const raw = await sanityClient.fetch<RawAbout | null>(ABOUT_QUERY);
  return raw ? toAboutData(raw) : null;
}
