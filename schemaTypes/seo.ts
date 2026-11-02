import { defineField, defineType } from 'sanity';

// Reusable per-page search/share overrides. Every field is optional — a page
// with nothing filled in keeps its existing title/description/image logic.
export default defineType({
  name: 'seo',
  title: 'SEO',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    defineField({
      name: 'title',
      title: 'Search title',
      description:
        'The title shown in Google results and the browser tab. Aim for under ~60 characters, lead with what people search for, end with "| Friendhood".',
      type: 'string',
      validation: (rule) => rule.max(70).warning('Google usually cuts titles off after ~60 characters.'),
    }),
    defineField({
      name: 'description',
      title: 'Search description',
      description: 'The snippet shown under the title in Google results. ~150-160 characters.',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.max(170).warning('Google usually cuts descriptions off after ~160 characters.'),
    }),
    defineField({
      name: 'image',
      title: 'Share image',
      description: 'Shown in link previews (social, Slack, iMessage, etc.). Ideally 1200×630.',
      type: 'image',
      options: { hotspot: true },
    }),
  ],
});
