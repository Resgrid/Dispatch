import { sanitizeHtmlContent } from '../html-sanitizer';

describe('sanitizeHtmlContent', () => {
  it('returns an empty string for empty input', () => {
    expect(sanitizeHtmlContent('')).toBe('');
  });

  it('preserves safe formatting markup', () => {
    const result = sanitizeHtmlContent('<p>Engine <strong>fully</strong> staffed</p>');

    expect(result).toContain('<strong>fully</strong>');
    expect(result).toContain('Engine');
  });

  it('drops script tags and their contents', () => {
    const result = sanitizeHtmlContent('<p>before</p><script>alert(1)</script><p>after</p>');

    expect(result).not.toContain('script');
    expect(result).not.toContain('alert(1)');
    expect(result).toContain('before');
    expect(result).toContain('after');
  });

  it('strips inline event handlers', () => {
    const result = sanitizeHtmlContent('<p onclick="steal()">tap me</p><img src="https://x.test/a.png" onerror="steal()" />');

    expect(result).not.toContain('onclick');
    expect(result).not.toContain('onerror');
    expect(result).toContain('tap me');
  });

  it('removes javascript: and data: URLs from links', () => {
    const result = sanitizeHtmlContent('<a href="javascript:alert(1)">tap</a>');

    expect(result).not.toContain('javascript:');
    expect(result).toContain('tap');
  });

  // The API returns some fields entity-encoded. Decoding has to happen before
  // sanitizing, otherwise an encoded payload passes through untouched and is
  // revived as live markup by the WebView.
  it('sanitizes payloads that arrive HTML-entity-encoded', () => {
    const result = sanitizeHtmlContent('&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;alert(2)&lt;/script&gt;');

    expect(result).not.toContain('onerror');
    expect(result).not.toContain('alert(1)');
    expect(result).not.toContain('alert(2)');
    expect(result).not.toContain('<script');
  });

  it('renders entity-encoded markup as real tags', () => {
    const result = sanitizeHtmlContent('&lt;p&gt;Structure fire&lt;/p&gt;');

    expect(result).toContain('<p>');
    expect(result).toContain('Structure fire');
  });

  it('leaves entities alone when the value already contains real markup', () => {
    const result = sanitizeHtmlContent('<p>Smith &amp; Sons</p>');

    expect(result).toContain('&amp;');
    expect(result).toContain('<p>');
  });
});
