// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sanity from '@sanity/astro';

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
      : [])
  ]
});