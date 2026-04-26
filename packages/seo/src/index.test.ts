import { describe, it, expect } from 'vitest';
import { generateMetaTags, generateSitemap, generateJsonLd } from './index.js';
import { ValidationError } from '@factory/errors';

describe('generateMetaTags', () => {
  it('generates required meta and OG tags', () => {
    const html = generateMetaTags({
      title: 'Factory',
      description: 'Shared infrastructure.',
      url: 'https://thefactory.dev',
    });
    expect(html).toContain('<meta name="title" content="Factory">');
    expect(html).toContain('<meta name="description"');
    expect(html).toContain('og:type');
    expect(html).toContain('og:url');
    expect(html).toContain('og:title');
    expect(html).toContain('twitter:card');
  });

  it('defaults type to website', () => {
    const html = generateMetaTags({ title: 'T', description: 'D', url: 'https://x.com' });
    expect(html).toContain('content="website"');
  });

  it('uses provided type', () => {
    const html = generateMetaTags({ title: 'T', description: 'D', url: 'https://x.com', type: 'article' });
    expect(html).toContain('content="article"');
  });

  it('includes image tags when image is provided', () => {
    const html = generateMetaTags({
      title: 'T',
      description: 'D',
      url: 'https://x.com',
      image: 'https://x.com/img.png',
    });
    expect(html).toContain('og:image');
    expect(html).toContain('twitter:image');
  });

  it('omits image tags when image is not provided', () => {
    const html = generateMetaTags({ title: 'T', description: 'D', url: 'https://x.com' });
    expect(html).not.toContain('og:image');
  });

  it('escapes HTML attribute special characters', () => {
    const html = generateMetaTags({
      title: 'A & B',
      description: '"Quoted"',
      url: 'https://x.com',
    });
    expect(html).toContain('A &amp; B');
    expect(html).toContain('&quot;Quoted&quot;');
  });

  it('throws ValidationError when title is empty', () => {
    expect(() => generateMetaTags({ title: '', description: 'D', url: 'https://x.com' }))
      .toThrow(ValidationError);
  });

  it('throws ValidationError when description is empty', () => {
    expect(() => generateMetaTags({ title: 'T', description: '', url: 'https://x.com' }))
      .toThrow(ValidationError);
  });

  it('throws ValidationError when url is empty', () => {
    expect(() => generateMetaTags({ title: 'T', description: 'D', url: '' }))
      .toThrow(ValidationError);
  });
});

describe('generateSitemap', () => {
  it('generates valid XML with required fields', () => {
    const xml = generateSitemap([{ url: 'https://example.com/' }]);
    expect(xml).toContain('<?xml version="1.0"');
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>https://example.com/</loc>');
    expect(xml).toContain('<changefreq>weekly</changefreq>');
    expect(xml).toContain('<priority>0.5</priority>');
  });

  it('uses provided priority and changefreq', () => {
    const xml = generateSitemap([{ url: 'https://x.com/', priority: 1.0, changefreq: 'daily' }]);
    expect(xml).toContain('<priority>1.0</priority>');
    expect(xml).toContain('<changefreq>daily</changefreq>');
  });

  it('handles multiple pages', () => {
    const xml = generateSitemap([
      { url: 'https://x.com/' },
      { url: 'https://x.com/about' },
    ]);
    expect(xml.match(/<url>/g)).toHaveLength(2);
  });

  it('escapes special characters in URLs', () => {
    const xml = generateSitemap([{ url: 'https://x.com/a&b' }]);
    expect(xml).toContain('&amp;');
  });

  it('throws ValidationError for empty pages array', () => {
    expect(() => generateSitemap([])).toThrow(ValidationError);
  });
});

describe('generateJsonLd', () => {
  it('generates a script tag with @context and @type', () => {
    const script = generateJsonLd('Organization', { name: 'Factory', url: 'https://thefactory.dev' });
    expect(script).toContain('<script type="application/ld+json">');
    expect(script).toContain('"@context": "https://schema.org"');
    expect(script).toContain('"@type": "Organization"');
    expect(script).toContain('"name": "Factory"');
    expect(script).toContain('</script>');
  });

  it('merges data fields into the JSON-LD object', () => {
    const script = generateJsonLd('SoftwareApplication', { name: 'App', operatingSystem: 'All' });
    const match = /<script[^>]*>([\s\S]*?)<\/script>/.exec(script);
    const parsed = JSON.parse(match![1]!) as Record<string, unknown>;
    expect(parsed['@type']).toBe('SoftwareApplication');
    expect(parsed['operatingSystem']).toBe('All');
  });

  it('supports Service type', () => {
    const script = generateJsonLd('Service', { name: 'API' });
    expect(script).toContain('"@type": "Service"');
  });
});
