import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'siteSettings',
  title: 'Site Settings',
  type: 'document',
  fields: [
    defineField({
      name: 'favicon',
      title: 'Favicon',
      description:
        'Browser tab icon. Square, ideally at least 512×512 so it stays sharp on high-density screens — Sanity generates the smaller sizes browsers actually request.',
      type: 'image',
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Default site title',
      description:
        'Shown in the browser tab and search results for any page that doesn\'t set its own more specific title.',
      type: 'string',
      initialValue: 'Friendhood',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Default meta description',
      description:
        '~150-160 characters ideally — shown in search results and link previews for any page that doesn\'t set its own.',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'ogImage',
      title: 'Default share image',
      description:
        'Shown in link previews (social, Slack, iMessage, etc.) for any page that doesn\'t set its own. Ideally 1200×630.',
      type: 'image',
      options: { hotspot: true },
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Site Settings' };
    },
  },
});
