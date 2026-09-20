#!/usr/bin/env node
// Scans the live Sanity dataset for images with no Alt text field filled
// in, so new uploads (a new case study, a swapped-out About photo, etc.)
// can be caught and fixed quickly instead of silently shipping on a
// generic fallback. Queries the `alt` field itself — not the rendered
// site — so it can't be fooled by the adapter's fallback text.
//
// Usage:
//   node scripts/find-missing-alt.mjs         human-readable list
//   node scripts/find-missing-alt.mjs --json  structured output, including
//                                              document _id and array _key
//                                              values needed to patch each
//                                              image's alt field precisely

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const jsonMode = process.argv.includes('--json');

function loadEnv() {
  const envPath = path.join(rootDir, '.env');
  const env = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

const env = loadEnv();
const projectId = env.PUBLIC_SANITY_PROJECT_ID;
const dataset = env.PUBLIC_SANITY_DATASET || 'production';
const token = env.SANITY_API_TOKEN;

if (!projectId || !token) {
  console.error('Missing PUBLIC_SANITY_PROJECT_ID or SANITY_API_TOKEN in .env');
  process.exit(1);
}

const QUERY = `{
  "projects": *[_type == "project" && !(_id in path("drafts.**"))]{
    _id,
    title,
    "slug": slug.current,
    "heroImage": heroImage{ alt, "url": asset->url, "hasAsset": defined(asset) },
    "cardImage": cardImage{ alt, "url": asset->url, "hasAsset": defined(asset) },
    "bodyImages": body[]{
      _key,
      _type,
      "images": items[_type == "image"]{ _key, alt, "url": asset->url, "hasAsset": defined(asset) }
    }
  },
  "about": *[_type == "about"][0]{
    _id,
    "introImage": introImage{ alt, "url": asset->url, "hasAsset": defined(asset) },
    "introImageWide": introImageWide{ alt, "url": asset->url, "hasAsset": defined(asset) },
    "approachCards": approachCards[]{ _key, title, "image": image{ alt, "url": asset->url, "hasAsset": defined(asset) } }
  }
}`;

const url = `https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}?query=${encodeURIComponent(QUERY)}`;
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
if (!res.ok) {
  console.error(`Sanity query failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const { result } = await res.json();

const missing = [];

// `patch` describes exactly how to set this image's alt field via Sanity's
// mutate API: { documentId, path } where `path` is a Sanity patch path
// string, e.g. "heroImage.alt" or "body[_key==\"abc\"].items[_key==\"xyz\"].alt".
function check(label, img, documentId, path) {
  if (img?.hasAsset && !img.alt) missing.push({ label, url: img.url, patch: { documentId, path } });
}

for (const project of result.projects) {
  check(`${project.title} (${project.slug}) — hero image`, project.heroImage, project._id, 'heroImage.alt');
  check(`${project.title} (${project.slug}) — card image`, project.cardImage, project._id, 'cardImage.alt');
  (project.bodyImages ?? []).forEach((block, blockIndex) => {
    (block.images ?? []).forEach((img, imgIndex) => {
      check(
        `${project.title} (${project.slug}) — body block ${blockIndex + 1}, image ${imgIndex + 1}`,
        img,
        project._id,
        `body[_key=="${block._key}"].items[_key=="${img._key}"].alt`
      );
    });
  });
}

if (result.about) {
  check('About — intro image (narrow)', result.about.introImage, result.about._id, 'introImage.alt');
  check('About — intro image (wide)', result.about.introImageWide, result.about._id, 'introImageWide.alt');
  (result.about.approachCards ?? []).forEach((card) => {
    check(
      `About — approach card "${card.title}"`,
      card.image,
      result.about._id,
      `approachCards[_key=="${card._key}"].image.alt`
    );
  });
}

if (jsonMode) {
  console.log(JSON.stringify(missing, null, 2));
} else if (missing.length === 0) {
  console.log('No images missing alt text.');
} else {
  console.log(`${missing.length} image(s) missing alt text:\n`);
  for (const item of missing) {
    console.log(`- ${item.label}\n  ${item.url}`);
  }
}
