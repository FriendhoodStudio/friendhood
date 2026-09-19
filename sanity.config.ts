import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { visionTool } from '@sanity/vision';
import { orderableDocumentListDeskItem } from '@sanity/orderable-document-list';
import { schemaTypes } from './schemaTypes';

const SINGLETON_TYPES = new Set(['footer', 'navMenu', 'hero', 'services', 'featuredWork', 'about']);
const ORDERABLE_TYPES = new Set(['project']);

// This file is bundled for the browser (the embedded Studio runs client-side),
// where `process.env` doesn't exist — Vite's `import.meta.env` works in both
// that context and when the Sanity CLI runs this config directly (also Vite-based).
const projectId = import.meta.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = import.meta.env.PUBLIC_SANITY_DATASET || 'production';

if (!projectId) {
  throw new Error(
    'Missing PUBLIC_SANITY_PROJECT_ID — set it in .env after running `sanity init`.'
  );
}

export default defineConfig({
  name: 'friendhood',
  title: 'Friendhood',
  projectId,
  dataset,
  basePath: '/studio',
  plugins: [
    structureTool({
      structure: (S, context) =>
        S.list()
          .title('Content')
          .items([
            S.listItem()
              .title('Hero')
              .id('hero')
              .child(S.document().schemaType('hero').documentId('hero')),
            S.listItem()
              .title('Services')
              .id('services')
              .child(S.document().schemaType('services').documentId('services')),
            S.listItem()
              .title('Featured Work')
              .id('featuredWork')
              .child(S.document().schemaType('featuredWork').documentId('featuredWork')),
            S.listItem()
              .title('About')
              .id('about')
              .child(S.document().schemaType('about').documentId('about')),
            S.listItem()
              .title('Nav Menu')
              .id('navMenu')
              .child(S.document().schemaType('navMenu').documentId('navMenu')),
            S.listItem()
              .title('Footer')
              .id('footer')
              .child(S.document().schemaType('footer').documentId('footer')),
            S.divider(),
            orderableDocumentListDeskItem({ type: 'project', title: 'Project', S, context }),
            ...S.documentTypeListItems().filter(
              (item) => !SINGLETON_TYPES.has(item.getId() ?? '') && !ORDERABLE_TYPES.has(item.getId() ?? '')
            ),
          ]),
    }),
    visionTool(),
  ],
  schema: { types: schemaTypes },
  document: {
    // Singletons (Footer) shouldn't appear in the "+" new-document menu or be duplicatable/deletable.
    newDocumentOptions: (prev, { creationContext }) =>
      creationContext.type === 'global'
        ? prev.filter((item) => !SINGLETON_TYPES.has(item.templateId))
        : prev,
    actions: (prev, { schemaType }) =>
      SINGLETON_TYPES.has(schemaType)
        ? prev.filter(({ action }) => action !== 'duplicate' && action !== 'delete')
        : prev,
  },
});
