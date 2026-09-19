import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'linkCards',
  title: 'Link Cards',
  type: 'document',
  fields: [
    defineField({
      name: 'cards',
      title: 'Cards',
      description: 'Image + label cards linking to other pages — drag to reorder.',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'linkCardItem',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              description: 'Short label shown on the card, e.g. "Work."',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'image',
              title: 'Image',
              type: 'image',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'href',
              title: 'URL',
              description: 'Full URL, or an internal path like /work.',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { title: 'label', subtitle: 'href', media: 'image' },
          },
        },
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Link Cards' };
    },
  },
});
