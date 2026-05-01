import { ValidationError } from '@latimer-woods-tech/errors';

/**
 * Options for {@link generateMetaTags}.
 */
export interface MetaTagOpts {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
}

/**
 * Generates HTML `<meta>` and Open Graph tags for a page.
 * Returns a multiline HTML string ready to inject into `<head>`.
 *
 * @example
 * ```ts
 * const tags = generateMetaTags({
 *   title: 'Factory',
 *   description: 'Shared infrastructure for Factory apps.',
 *   url: 'https://thefactory.dev',
 * });
 * // <meta name="title" content="Factory"> ...
 * ```
 */
export function generateMetaTags(opts: MetaTagOpts): string {
  if (!opts.title.trim()) throw new ValidationError('title is required');
  if (!opts.description.trim()) throw new ValidationError('description is required');
  if (!opts.url.trim()) throw new ValidationError('url is required');

  const pageType = opts.type ?? 'website';
  const lines: string[] = [
    `<meta name="title" content="${escape(opts.title)}">`,
    `<meta name="description" content="${escape(opts.description)}">`,
    `<meta property="og:type" content="${escape(pageType)}">`,
    `<meta property="og:url" content="${escape(opts.url)}">`,
    `<meta property="og:title" content="${escape(opts.title)}">`,
    `<meta property="og:description" content="${escape(opts.description)}">`,
    `<meta property="twitter:card" content="summary_large_image">`,
    `<meta property="twitter:url" content="${escape(opts.url)}">`,
    `<meta property="twitter:title" content="${escape(opts.title)}">`,
    `<meta property="twitter:description" content="${escape(opts.description)}">`,
  ];

  if (opts.image) {
    lines.push(`<meta property="og:image" content="${escape(opts.image)}">`);
    lines.push(`<meta property="twitter:image" content="${escape(opts.image)}">`);
  }

  return lines.join('\n');
}

/**
 * A single page entry for the XML sitemap.
 */
export interface SitemapPage {
  url: string;
  priority?: number;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
}

/**
 * Generates an XML sitemap string for the given pages.
 *
 * @example
 * ```ts
 * const xml = generateSitemap([{ url: 'https://example.com/', priority: 1.0 }]);
 * ```
 */
export function generateSitemap(pages: SitemapPage[]): string {
  if (pages.length === 0) throw new ValidationError('pages array must not be empty');

  const urlEntries = pages.map(page => {
    const priority = page.priority ?? 0.5;
    const changefreq = page.changefreq ?? 'weekly';
    return [
      '  <url>',
      `    <loc>${escapeXml(page.url)}</loc>`,
      `    <changefreq>${changefreq}</changefreq>`,
      `    <priority>${priority.toFixed(1)}</priority>`,
      '  </url>',
    ].join('\n');
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urlEntries,
    '</urlset>',
  ].join('\n');
}

/**
 * Supported JSON-LD schema types.
 */
export type JsonLdType = 'Organization' | 'SoftwareApplication' | 'Service';

/**
 * Generates a `<script type="application/ld+json">` tag containing
 * structured data in JSON-LD format.
 *
 * @example
 * ```ts
 * const script = generateJsonLd('Organization', {
 *   name: 'Factory',
 *   url: 'https://thefactory.dev',
 * });
 * ```
 */
export function generateJsonLd(type: JsonLdType, data: Record<string, unknown>): string {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data,
  };
  return `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Escapes HTML attribute special characters.
 * @internal
 */
function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Escapes XML element content special characters.
 * @internal
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
