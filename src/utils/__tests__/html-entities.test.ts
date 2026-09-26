import { escapeHtml } from '../html-entities';

describe('escapeHtml', () => {
  it('escapes the characters that can start markup or leave an attribute', () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')"> & more`)).toBe('&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; more');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Engine 41 — Station 3')).toBe('Engine 41 — Station 3');
  });
});
