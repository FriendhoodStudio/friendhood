// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sanity from '@sanity/astro';
import sitemap from '@astrojs/sitemap';

// astro.config.mjs runs in plain Node before Astro's own .env loading applies
// to app code, so process.env.PUBLIC_SANITY_PROJECT_ID is empty here unless we
// load .env ourselves via Vite's loadEnv.
const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET } = loadEnv(
  process.env.NODE_ENV ?? 'development',
  process.cwd(),
  ''
);

// https://astro.build/config
export default defineConfig({
  // Required for canonical URLs and sitemap generation — update if the
  // production domain ends up different from the current live site.
  site: 'https://friendhood.co.uk',
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [
    react(),
    // Skips cleanly (rather than crashing) until a real projectId is set in .env
    ...(PUBLIC_SANITY_PROJECT_ID
      ? [
          sanity({
            projectId: PUBLIC_SANITY_PROJECT_ID,
            dataset: PUBLIC_SANITY_DATASET || 'production',
            useCdn: false,
            studioBasePath: '/studio'
          })
        ]
      : []),
    // Embedded Sanity Studio at /studio is admin tooling, not a real page —
    // excluded so it never ends up in search results.
    sitemap({ filter: (page) => !page.includes('/studio') })
  ]
});