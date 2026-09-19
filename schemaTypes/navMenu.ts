import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'navMenu',
  title: 'Nav Menu',
  type: 'document',
  fields: [
    defineField({
      name: 'pageLinks',
      title: 'Page links',
      description: 'Main navigation links (e.g. Home, Work, About) — drag to reorder.',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'pageLink',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'href',
              title: 'URL',
              description: 'Internal path, e.g. /work.',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { title: 'label', subtitle: 'href' },
          },
        },
      ],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'contactLinks',
      title: 'Contact links',
      description: 'Shown under "Contact" — drag to reorder.',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'contactLink',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'linkType',
              title: 'Type',
              type: 'string',
              options: {
                list: [
                  { title: 'Copy email to clipboard', value: 'email' },
                  { title: 'Link', value: 'link' },
                ],
                layout: 'radio',
              },
              initialValue: 'link',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'email',
              title: 'Email address',
              type: 'string',
              hidden: ({ parent }) => parent?.linkType !== 'email',
              validation: (rule) =>
                rule.custom((value, context) => {
                  const parent = context.parent as { linkType?: string } | undefined;
                  if (parent?.linkType === 'email' && !value) return 'Required when type is Email';
                  return true;
                }),
            }),
            defineField({
              name: 'href',
              title: 'URL',
              description: 'Full URL, e.g. https://linkedin.com/company/...',
              type: 'string',
              hidden: ({ parent }) => parent?.linkType !== 'link',
              validation: (rule) =>
                rule.custom((value, context) => {
                  const parent = context.parent as { linkType?: string } | undefined;
                  if (parent?.linkType === 'link' && !value) return 'Required when type is Link';
                  return true;
                }),
            }),
          ],
          preview: {
            select: { title: 'label', subtitle: 'href', email: 'email', linkType: 'linkType' },
            prepare({ title, subtitle, email, linkType }) {
              return { title, subtitle: linkType === 'email' ? email : subtitle };
            },
          },
        },
      ],
      validation: (rule) => rule.required().min(1),
    }),
  ],
  preview: {
    prepare() {
      return { title: 'Nav Menu' };
    },
  },
});
