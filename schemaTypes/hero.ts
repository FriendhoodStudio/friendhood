import { defineField, defineType } from 'sanity';

export default defineType({
  name: 'hero',
  title: 'Hero',
  type: 'document',
  fields: [
    defineField({
      name: 'headline',
      title: 'Headline',
      type: 'text',
      rows: 2,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'headlineSwapWord',
      title: 'Headline hover word',
      description:
        'The exact word in the headline above that swaps out each time it\'s hovered, e.g. "people". Leave blank to disable the effect.',
      type: 'string',
    }),
    defineField({
      name: 'headlineHoverWords',
      title: 'Headline hover word alternates',
      description: 'Words to cycle through in place of the hover word above, one per hover.',
      type: 'array',
      of: [{ type: 'string' }],
      hidden: ({ parent }) => !parent?.headlineSwapWord,
    }),
    defineField({
      name: 'tagline',
      title: 'Tagline',
      description: 'Small line shown above the hero media, e.g. "Move into the friendhood ↴".',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'mediaType',
      title: 'Hero media type',
      type: 'string',
      options: {
        list: [
          { title: 'Image', value: 'image' },
          { title: 'Video', value: 'video' },
        ],
        layout: 'radio',
      },
      initialValue: 'image',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero image',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.mediaType !== 'image',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string } | undefined;
          if (parent?.mediaType === 'image' && !value) return 'Required when media type is Image';
          return true;
        }),
    }),
    defineField({
      name: 'heroVideo',
      title: 'Hero video',
      description: 'Short looping clip — played muted, autoplaying, no controls.',
      type: 'file',
      options: { accept: 'video/*' },
      hidden: ({ parent }) => parent?.mediaType !== 'video',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string } | undefined;
          if (parent?.mediaType === 'video' && !value) return 'Required when media type is Video';
          return true;
        }),
    }),
    defineField({
      name: 'videoPoster',
      title: 'Video poster image',
      description: 'Shown while the video loads and used as the still fallback.',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.mediaType !== 'video',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { mediaType?: string } | undefined;
          if (parent?.mediaType === 'video' && !value) return 'Required when media type is Video';
          return true;
        }),
    }),
  ],
  preview: {
    select: {
      title: 'headline',
      mediaType: 'mediaType',
      heroImage: 'heroImage',
      videoPoster: 'videoPoster',
    },
    prepare({ title, mediaType, heroImage, videoPoster }) {
      return {
        title: 'Hero',
        subtitle: title,
        media: mediaType === 'video' ? videoPoster : heroImage,
      };
    },
  },
});
