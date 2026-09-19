import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'module',
  title: 'Modules',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      description: 'Shown on the module tag, e.g. "Workshop".',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
  ],
  preview: {
    select: { title: 'title' },
  },
});
