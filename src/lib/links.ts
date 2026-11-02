/** Attributes that open a link in a new tab when it points off-site (a full
 * http(s) URL, e.g. Instagram/LinkedIn), so visitors don't lose their place
 * on the site. Internal paths, mailto: and tel: links stay in the same tab. */
export function externalLinkAttrs(href?: string) {
  return href && /^https?:\/\//i.test(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {};
}
