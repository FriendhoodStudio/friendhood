import { defineField, defineType } from 'sanity';

// A single item in an ImageCarousel (see src/components/ImageCarousel.astro)
// — reusable across any document/array field that wants an editor-orderable,
// unlimited-length row of images alternating narrow/wide sizes. Not scoped
// to About specifically, even though that's the only current consumer.
export default defineType({
  name: 'carouselImage',
  title: 'Carousel image',
  type: 'object',
  fields: [
    defineField({
      name: 'image',
      title: 'Image',
      description:
        'Alt text comes from the asset itself (set once in the Media Library, or wherever this same image was first uploaded) — reusing an image already used elsewhere on the site carries its alt text automatically, no re-typing needed here.',
      type: 'image',
      options: { hotspot: true },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'wide',
      title: 'Wide',
      description: 'On, this image takes the wider of the carousel\'s two sizes; off, the narrow (regular) size.',
      type: 'boolean',
      initialValue: false,
    }),
  ],
  preview: {
    select: { media: 'image', alt: 'image.asset.altText', wide: 'wide' },
    prepare({ media, alt, wide }) {
      return {
        title: alt || 'Untitled image',
        subtitle: wide ? 'Wide' : 'Regular',
        media,
      };
    },
  },
});
