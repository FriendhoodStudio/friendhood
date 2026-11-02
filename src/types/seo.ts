/** Per-page search/share overrides from Sanity's `seo` object — every field
 * optional, so callers fall back to their existing defaults with `??`. */
export interface SeoData {
  title?: string;
  description?: string;
  imageUrl?: string;
}
