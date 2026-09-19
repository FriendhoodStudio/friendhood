import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'services',
  title: 'Services',
  type: 'document',
  fields: [
    defineField({
      name: 'descriptor',
      title: 'Descriptor',
      description: 'Small label above the paragraph, e.g. "How we help".',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'paragraph',
      title: 'Paragraph',
      type: 'text',
      rows: 4,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'services',
      title: 'Services list',
      description:
        'Clicking a name in the grid opens its card in the carousel — drag to reorder.',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'serviceItem',
          fields: [
            defineField({
              name: 'name',
              title: 'Name',
              description: 'Short name shown in the grid, e.g. "Strategy".',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'cardTitle',
              title: 'Card title',
              description: 'Title shown at the top of the card — can be longer than Name.',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'image',
              title: 'Image',
              type: 'image',
              options: { hotspot: true },
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'overview',
              title: 'Overview',
              type: 'text',
              rows: 3,
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'modules',
              title: 'Example modules',
              description: 'Tags shown at the bottom of the card, drawn from the shared Modules list.',
              type: 'array',
              of: [{ type: 'reference', to: [{ type: 'module' }] }],
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: {
            select: { title: 'name', subtitle: 'cardTitle', media: 'image' },
          },
        },
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Services' };
    },
  },
});
