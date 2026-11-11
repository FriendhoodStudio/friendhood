import type { APIRoute, GetStaticPaths } from 'astro';
import sharp from 'sharp';
import { fetchHero } from '../../lib/sanity/queries';
import { SOFT_H, SOFT_PAD, SOFT_RADIUS, SOFT_SIGMA, SOFT_W, softId, type SoftLevel } from '../../lib/heroSoft';

/** The hero stream's blurred images, made at build time (see heroSoft.ts):
 * one per pop-up image and depth layer, written out as static files. A
 * Studio publish already triggers a rebuild, so new images get theirs. */

export const getStaticPaths = (async () => {
  const hero = await fetchHero();
  const seen = new Set<string>();
  const paths = [];
  for (const image of hero?.popUpImages ?? []) {
    const id = softId(image.url);
    if (seen.has(id)) continue;
    seen.add(id);
    for (const level of Object.keys(SOFT_SIGMA) as SoftLevel[]) {
      paths.push({ params: { name: `${id}-${level}` }, props: { url: image.url, level } });
    }
  }
  return paths;
}) satisfies GetStaticPaths;

const roundedMask = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SOFT_W}" height="${SOFT_H}">` +
    `<rect width="${SOFT_W}" height="${SOFT_H}" rx="${SOFT_RADIUS}" ry="${SOFT_RADIUS}"/></svg>`
);

export const GET: APIRoute = async ({ props }) => {
  const { url, level } = props as { url: string; level: SoftLevel };
  // Cropped to 4:5 from the centre by Sanity, as the sharp image is by CSS.
  const source = await fetch(`${url.split('?')[0]}?w=${SOFT_W}&h=${SOFT_H}&fit=crop&fm=png`);
  if (!source.ok) return new Response(null, { status: 404 });
  // Round the corners first (composite always runs last in a sharp
  // pipeline, so it's its own step), then pad and blur.
  const rounded = await sharp(Buffer.from(await source.arrayBuffer()))
    .resize(SOFT_W, SOFT_H, { fit: 'cover' })
    .ensureAlpha()
    .composite([{ input: roundedMask, blend: 'dest-in' }])
    .png()
    .toBuffer();
  const soft = await sharp(rounded)
    .extend({ top: SOFT_PAD, bottom: SOFT_PAD, left: SOFT_PAD, right: SOFT_PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .blur(SOFT_SIGMA[level])
    .webp({ quality: 82, alphaQuality: 90 })
    .toBuffer();
  return new Response(new Uint8Array(soft), {
    headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' },
  });
};
