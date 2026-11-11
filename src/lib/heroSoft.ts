/** Shared between the build-time endpoint that makes the hero stream's
 * blurred images (src/pages/hero-soft/[name].webp.ts) and the stream itself
 * (heroStream.ts), so both agree on their size and padding.
 *
 * Each blurred copy is the image cropped to 4:5, its corners rounded to the
 * site's card radius, then blurred on a transparent canvas with SOFT_PAD of
 * room all round for the blur to spread into. Rounding before blurring is
 * what makes every blurred image's corners match the sharp one's: Sanity's
 * own blur only works on the whole rectangle. */

// The image's size within the blurred copy, and the padding around it.
export const SOFT_W = 240;
export const SOFT_H = 300;
export const SOFT_PAD = 44;
// Corner radius at that size: the site's 30px card radius on an image
// about 270px wide.
export const SOFT_RADIUS = 27;
// Blur strength (Gaussian sigma, at that size) for the stream's two layers.
export const SOFT_SIGMA = { near: 9, back: 14 } as const;
export type SoftLevel = keyof typeof SOFT_SIGMA;

/** The Sanity asset's file name without its extension (e.g.
 * "af45fe…-2560x1710"), which names its blurred copies. */
export function softId(url: string) {
  return url.split('?')[0].split('/').pop()!.replace(/\.[a-z0-9]+$/i, '');
}

export function softPath(url: string, level: SoftLevel) {
  return `/hero-soft/${softId(url)}-${level}.webp`;
}
