import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'featuredWork',
  title: 'Featured Work',
  type: 'document',
  fields: [
    defineField({
      name: 'descriptor',
      title: 'Descriptor',
      description: 'Small label above the heading, e.g. "Our work".',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'buttonLabel',
      title: 'Button label',
      type: 'string',
      initialValue: 'See more',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'buttonHref',
      title: 'Button URL',
      type: 'string',
      initialValue: '/work',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Featured Work' };
    },
  },
});
