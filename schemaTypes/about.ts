import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'about',
  title: 'About',
  type: 'document',
  fields: [
    defineField({
      name: 'introLabel',
      title: 'Intro label',
      description: 'Bold lead-in, e.g. "Who we are."',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'introLabelMuted',
      title: 'Intro label (muted continuation)',
      description: 'Greyed-out rest of the label, e.g. "Built to change your world."',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'introHeading',
      title: 'Intro heading',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'introImage',
      title: 'Intro image (narrow)',
      type: 'image',
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'introImageWide',
      title: 'Intro image (wide)',
      type: 'image',
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'servicesLabel',
      title: 'Services section label',
      type: 'string',
      initialValue: 'Our services',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'servicesHeading',
      title: 'Services section heading',
      type: 'text',
      rows: 2,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'approachLabel',
      title: 'Approach section label',
      type: 'string',
      initialValue: 'Our approach',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'approachHeading',
      title: 'Approach section heading',
      type: 'text',
      rows: 2,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'approachCards',
      title: 'Approach cards',
      description: 'e.g. "On purpose.", "By design.", "With love."',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'approachCard',
          fields: [
            defineField({
              name: 'title',
              title: 'Title',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'text',
              title: 'Text',
              type: 'text',
              rows: 3,
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'image',
              title: 'Image',
              type: 'image',
              options: { hotspot: true },
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { title: 'title', subtitle: 'text', media: 'image' },
          },
        },
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'clientsLabel',
      title: 'Clients section label',
      type: 'string',
      initialValue: 'Client experience',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'clients',
      title: 'Clients',
      description: 'Client names, shown as a single line separated by "•".',
      type: 'array',
      of: [{ type: 'string' }],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare() {
      return { title: 'About' };
    },
  },
});
