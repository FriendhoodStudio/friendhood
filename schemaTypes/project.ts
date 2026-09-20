import { defineField, defineType } from 'sanity';
import { orderRankField, orderRankOrdering } from '@sanity/orderable-document-list';

export default defineType({
  name: 'project',
  title: 'Project',
  type: 'document',
  orderings: [orderRankOrdering],
  fields: [
    orderRankField({ type: 'project' }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'detail',
      title: 'Detail',
      description: 'Short subtitle shown under the project title on the card.',
      type: 'text',
      rows: 2,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'comingSoon',
      title: 'Coming soon',
      description:
        'Shows a "Coming soon" placeholder over the card image instead of the real media, and the card is not clickable — for announcing a project before its case study is ready.',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'categories',
      title: 'Categories',
      description: 'Category tags shown on the card and case study.',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'category' }] }],
      validation: (rule) => rule.required().min(1),
    }),
    defineField({
      name: 'openingStatement',
      title: 'Opening statement',
      description: 'Big intro line at the top of the case study page, under the project name.',
      type: 'text',
      rows: 3,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'heroImage',
      title: 'Case study hero image',
      description:
        'Always shown directly under the opening statement — not part of the modular body below, since Figma marks this placement as fixed for every case study. (Distinct from the Card image below, which is the thumbnail shown on the Home/Work grids.)',
      type: 'image',
      options: { hotspot: true },
      fields: [
        defineField({
          name: 'alt',
          title: 'Alt text',
          description:
            'Describes the image for screen readers and search engines — this is real case study content, not decoration, so please fill it in.',
          type: 'string',
        }),
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'overview',
      title: 'Overview',
      description:
        'Large, full-width statement shown directly under the hero image, right before the Services/category tags — a fixed part of every case study, not part of the modular body below. Figma: "CaseStudy-Overview".',
      type: 'object',
      fields: [
        defineField({
          name: 'label',
          title: 'Label',
          type: 'string',
          initialValue: 'Overview',
          validation: (rule) => rule.required(),
        }),
        defineField({
          name: 'text',
          title: 'Text',
          type: 'text',
          rows: 4,
          validation: (rule) => rule.required(),
        }),
      ],
      preview: {
        select: { title: 'label', subtitle: 'text' },
      },
    }),
    defineField({
      name: 'body',
      title: 'Case study body',
      description:
        'The modular middle content of the case study — mix and reorder Media and Paragraph blocks freely. Length and image count vary per project.',
      type: 'array',
      of: [
        {
          type: 'object',
          name: 'mediaBlock',
          title: 'Media',
          fields: [
            defineField({
              name: 'items',
              title: 'Media',
              description:
                'One item renders full width; two render side by side. Mix images and video freely — video plays muted, autoplaying, looped, matching the Project card video treatment.',
              type: 'array',
              of: [
                {
                  type: 'image',
                  options: { hotspot: true },
                  fields: [
                    defineField({
                      name: 'alt',
                      title: 'Alt text',
                      description: 'Describes the image for screen readers and search engines.',
                      type: 'string',
                    }),
                  ],
                },
                { type: 'file', title: 'Video', options: { accept: 'video/*' } },
              ],
              validation: (rule) => rule.required().min(1).max(2),
            }),
          ],
          preview: {
            select: { media: 'items.0', count: 'items.length' },
            prepare({ media, count }) {
              return { title: 'Media', subtitle: count === 2 ? '2 images (side by side)' : '1 image', media };
            },
          },
        },
        {
          type: 'object',
          name: 'paragraphBlock',
          title: 'Paragraph',
          description:
            'Smaller body copy in a narrower column, label stacked above the text — for supporting/secondary text. Figma: "CaseStudy-Paragraph".',
          fields: [
            defineField({
              name: 'label',
              title: 'Label',
              type: 'string',
              initialValue: 'Overview',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'text',
              title: 'Text',
              type: 'text',
              rows: 4,
              validation: (rule) => rule.required(),
            }),
          ],
          preview: {
            select: { title: 'label', subtitle: 'text' },
            prepare({ title, subtitle }) {
              return { title: `${title} (Paragraph)`, subtitle };
            },
          },
        },
        {
          type: 'object',
          name: 'carouselBlock',
          title: 'Image carousel',
          description:
            'A scrollable row of images with prev/next controls, alternating narrow/wide sizes — same ImageCarousel module used on the About page. Drag to reorder, toggle "Wide" per image, any number of images.',
          fields: [
            defineField({
              name: 'images',
              title: 'Images',
              type: 'array',
              of: [{ type: 'carouselImage' }],
              validation: (rule) => rule.required().min(1),
            }),
          ],
          preview: {
            select: { media: 'images.0.image', count: 'images.length' },
            prepare({ media, count }) {
              return { title: 'Image carousel', subtitle: `${count} image${count === 1 ? '' : 's'}`, media };
            },
          },
        },
      ],
    }),
    defineField({
      name: 'featuredOnHome',
      title: 'Show on Home highlights',
      description: 'Featured in the curated project row on the homepage. The Work page always shows every project.',
      type: 'boolean',
      initialValue: false,
    }),
    defineField({
      name: 'cardMediaType',
      title: 'Card media type',
      description: 'Media shown on the Home/Work grid card — distinct from the case study hero image above.',
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
      name: 'cardImage',
      title: 'Card image',
      description: 'Still shown while "Coming soon" is on — the placeholder overlays on top of it.',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.cardMediaType !== 'image',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { cardMediaType?: string } | undefined;
          if (parent?.cardMediaType === 'image' && !value) return 'Required when media type is Image';
          return true;
        }),
    }),
    defineField({
      name: 'cardVideo',
      title: 'Card video',
      description: 'Short looping clip — played muted, autoplaying, no controls.',
      type: 'file',
      options: { accept: 'video/*' },
      hidden: ({ parent }) => parent?.cardMediaType !== 'video',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { cardMediaType?: string } | undefined;
          if (parent?.cardMediaType === 'video' && !value) return 'Required when media type is Video';
          return true;
        }),
    }),
    defineField({
      name: 'cardVideoPoster',
      title: 'Card video poster image',
      description: 'Shown while the video loads and used as the still fallback on the card.',
      type: 'image',
      options: { hotspot: true },
      hidden: ({ parent }) => parent?.cardMediaType !== 'video',
      validation: (rule) =>
        rule.custom((value, context) => {
          const parent = context.parent as { cardMediaType?: string } | undefined;
          if (parent?.cardMediaType === 'video' && !value) return 'Required when media type is Video';
          return true;
        }),
    }),
    defineField({
      name: 'footer',
      title: 'Case study footer',
      description:
        'Always shown at the end of the case study page — each element below is optional and can be independently toggled on or off.',
      type: 'object',
      fields: [
        defineField({
          name: 'showImpact',
          title: 'Show Impact',
          type: 'boolean',
          initialValue: false,
        }),
        defineField({
          name: 'impactStats',
          title: 'Impact stats',
          description: 'e.g. value "110% ↑", label "Visitors since launch of site".',
          type: 'array',
          of: [
            {
              type: 'object',
              name: 'impactStat',
              fields: [
                defineField({
                  name: 'value',
                  title: 'Value',
                  type: 'string',
                  validation: (rule) => rule.required(),
                }),
                defineField({
                  name: 'label',
                  title: 'Label',
                  type: 'string',
                  validation: (rule) => rule.required(),
                }),
              ],
              preview: {
                select: { title: 'value', subtitle: 'label' },
              },
            },
          ],
          hidden: ({ parent }) => !parent?.showImpact,
        }),
        defineField({
          name: 'showCollaborators',
          title: 'Show Collaborators',
          type: 'boolean',
          initialValue: false,
        }),
        defineField({
          name: 'collaborators',
          title: 'Collaborators',
          description: 'e.g. role "Motion", name "Dave Morrow".',
          type: 'array',
          of: [
            {
              type: 'object',
              name: 'collaborator',
              fields: [
                defineField({
                  name: 'role',
                  title: 'Role',
                  type: 'string',
                  validation: (rule) => rule.required(),
                }),
                defineField({
                  name: 'name',
                  title: 'Name',
                  type: 'string',
                  validation: (rule) => rule.required(),
                }),
              ],
              preview: {
                select: { title: 'role', subtitle: 'name' },
              },
            },
          ],
          hidden: ({ parent }) => !parent?.showCollaborators,
        }),
        defineField({
          name: 'showQuote',
          title: 'Show Quote',
          type: 'boolean',
          initialValue: false,
        }),
        defineField({
          name: 'quote',
          title: 'Quote',
          type: 'object',
          fields: [
            defineField({
              name: 'text',
              title: 'Quote',
              type: 'text',
              rows: 3,
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'attributionName',
              title: 'Attribution name',
              type: 'string',
              validation: (rule) => rule.required(),
            }),
            defineField({
              name: 'attributionCompany',
              title: 'Attribution company',
              type: 'string',
            }),
          ],
          hidden: ({ parent }) => !parent?.showQuote,
        }),
      ],
    }),
    defineField({
      name: 'relatedProjects',
      title: 'Discover more',
      description: 'Up to 3 other projects shown in a "Discover more" grid at the end of this case study.',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{ type: 'project' }],
          options: {
            // Excludes this project from its own "Discover more" picker —
            // checks both the draft and published id, since which one _id
            // actually is depends on whether THIS document currently has
            // unpublished edits.
            filter: ({ document }) => {
              const id = (document._id as string).replace(/^drafts\./, '');
              return { filter: '!(_id in $ids)', params: { ids: [id, `drafts.${id}`] } };
            },
          },
        },
      ],
      validation: (rule) => rule.max(3).unique(),
    }),
  ],
  preview: {
    select: {
      title: 'title',
      subtitle: 'detail',
      cardMediaType: 'cardMediaType',
      cardImage: 'cardImage',
      cardVideoPoster: 'cardVideoPoster',
    },
    prepare({ title, subtitle, cardMediaType, cardImage, cardVideoPoster }) {
      return {
        title,
        subtitle,
        media: cardMediaType === 'video' ? cardVideoPoster : cardImage,
      };
    },
  },
});
