import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'logoCarousel',
  title: 'Logo Carousel',
  type: 'document',
  fields: [
    defineField({
      name: 'logos',
      title: 'Logos',
      description: 'Client/partner logos shown in the infinite-scrolling strip — drag to reorder.',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'logoItem',
          fields: [
            defineField({
              name: 'name',
              title: 'Name',
              description: 'Used as the image alt text, e.g. "BBC Children in Need".',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'logo',
              title: 'Logo',
              type: 'image',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { title: 'name', media: 'logo' },
          },
        },
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Logo Carousel' };
    },
  },
});
