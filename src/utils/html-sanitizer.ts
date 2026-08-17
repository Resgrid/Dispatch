/**
 * HTML sanitizer for API-supplied content rendered inside WebViews.
 *
 * Fields like call Nature, call/contact notes and protocol text are authored server-side
 * and rendered as real markup, so they must be sanitized before injection — otherwise a
 * crafted note is script execution inside the WebView. Mirrors the strict allowlist used
 * by the Responder app so the apps stay consistent.
 */

import sanitizeHtmlLib from 'sanitize-html';

import { decodeHtmlEntitiesIfEncoded } from './html-entities';

/**
 * Checks if a URL scheme is safe (not javascript: or data:)
 */
function isSafeScheme(url: string): boolean {
  if (!url) return false;
  const normalizedUrl = url.toLowerCase().trim();
  return !normalizedUrl.startsWith('javascript:') && !normalizedUrl.startsWith('data:');
}

/**
 * Filters attributes to remove dangerous ones (on* events, unsafe styles)
 */
function filterDangerousAttributes(tag: string, name: string, value: string): boolean {
  // Block all event handlers (onclick, onload, etc.)
  if (name.toLowerCase().startsWith('on')) {
    return false;
  }

  // Block style attributes with expressions or javascript
  if (name.toLowerCase() === 'style') {
    const normalizedValue = value.toLowerCase();
    if (normalizedValue.includes('expression(') || normalizedValue.includes('javascript:')) {
      return false;
    }
  }

  // For URL attributes, ensure safe schemes
  if (['href', 'src', 'srcset', 'srcdoc'].includes(name.toLowerCase())) {
    return isSafeScheme(value);
  }

  return true;
}

// Strict sanitization configuration with explicit allowlist
export const strictSanitizeConfig: sanitizeHtmlLib.IOptions = {
  // Allow only safe HTML tags - strict allowlist (includes table tags for webview compatibility)
  allowedTags: [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'span',
    'div',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'blockquote',
    'pre',
    'code',
    // Table tags for webview compatibility
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    // Additional formatting tags
    'hr',
    's',
    'small',
    'sub',
    'sup',
    'dl',
    'dt',
    'dd',
  ],

  // Allow only safe attributes - strict allowlist with filtering
  allowedAttributes: {
    a: ['href', 'title'],
    img: ['src', 'alt', 'title', 'width', 'height'],
    span: ['style'],
    div: ['style'],
    p: ['style'],
    table: ['width', 'cellpadding', 'cellspacing'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['class'],
  },

  // Allow only safe URL schemes
  allowedSchemes: ['http', 'https', 'mailto'],

  // Specific schemes allowed per tag
  allowedSchemesByTag: {
    a: ['http', 'https', 'mailto'],
    img: ['http', 'https'],
  },

  // Disallow unknown tags (strict mode)
  disallowedTagsMode: 'discard',

  // Additional security options
  allowedIframeHostnames: [], // No iframes allowed
  allowedScriptHostnames: [], // No scripts allowed

  // Style attribute options - very restrictive
  allowedStyles: {
    '*': {
      color: [/^#(0x)?[0-9a-f]+$/i, /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/],
      'text-align': [/^left$/, /^right$/, /^center$/, /^justify$/],
      'font-size': [/^\d+(?:px|em|%)$/],
      'font-weight': [/^(?:normal|bold|bolder|lighter|\d+)$/],
      margin: [/^\d+(?:px|em|%)$/],
      padding: [/^\d+(?:px|em|%)$/],
    },
  },

  // Remove empty elements and dangerous tags
  nonTextTags: ['style', 'script', 'textarea', 'option'],

  // Transform tags for better security and validation
  transformTags: {
    a: (tagName, attribs) => {
      // Validate href attribute and remove if unsafe
      if (attribs.href && !isSafeScheme(attribs.href)) {
        delete attribs.href;
      }

      // Filter out dangerous attributes
      const filteredAttribs: Record<string, string> = {};
      Object.entries(attribs).forEach(([name, value]) => {
        if (filterDangerousAttributes(tagName, name, value)) {
          filteredAttribs[name] = value;
        }
      });

      return {
        tagName: 'a',
        attribs: {
          ...filteredAttribs,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      };
    },
    img: (tagName, attribs) => {
      // Validate src attribute and remove if unsafe
      if (attribs.src && !isSafeScheme(attribs.src)) {
        delete attribs.src;
      }

      // Filter out dangerous attributes
      const filteredAttribs: Record<string, string> = {};
      Object.entries(attribs).forEach(([name, value]) => {
        if (filterDangerousAttributes(tagName, name, value)) {
          filteredAttribs[name] = value;
        }
      });

      return {
        tagName: 'img',
        attribs: filteredAttribs,
      };
    },
    // Apply filtering to all other tags
    '*': (tagName, attribs) => {
      const filteredAttribs: Record<string, string> = {};
      Object.entries(attribs).forEach(([name, value]) => {
        if (filterDangerousAttributes(tagName, name, value)) {
          filteredAttribs[name] = value;
        }
      });

      return {
        tagName,
        attribs: filteredAttribs,
      };
    },
  },
};

/**
 * Sanitizes API-supplied HTML for safe injection into a WebView document.
 *
 * Entity-decoding happens first because some fields arrive encoded (`&lt;p&gt;…`);
 * decoding after sanitizing would let an encoded payload slip through untouched.
 */
export const sanitizeHtmlContent = (html: string): string => {
  if (!html) {
    return '';
  }

  return sanitizeHtmlLib(decodeHtmlEntitiesIfEncoded(html), strictSanitizeConfig);
};
