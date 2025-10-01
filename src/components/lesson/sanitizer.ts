// src/components/lesson/sanitizer.ts
import DOMPurify from 'dompurify';

// Allowlist for iframe hosts (embed only)
const YT = /^(https?:)?\/\/((www\.)?youtube\.com|youtu\.be|(www\.)?youtube\-nocookie\.com)\/.*/i;
const VIMEO = /^(https?:)?\/\/(player\.)?vimeo\.com\/.*/i;

export function sanitizeHtml(input: string) {
  // Normalize common JSX-ish attribute that can sneak in from builders
  const normalized = String(input || '').replace(/\bclassName=/g, 'class=');

  // Sanitize with a media-friendly allowlist.
  // DOMPurify already strips event handlers (on*), javascript: URLs, etc.
  const clean = DOMPurify.sanitize(normalized, {
    USE_PROFILES: { html: true },
    ADD_TAGS: ['iframe', 'video', 'source', 'figure', 'figcaption'],
    ADD_ATTR: [
      // generic
      'class', 'style', 'title',
      // anchors
      'href', 'target', 'rel',
      // common media attrs
      'src', 'width', 'height', 'alt', 'loading',
      // <video>
      'controls', 'playsinline', 'poster', 'preload', 'muted', 'loop', 'autoplay',
      // <iframe>
      'allow', 'allowfullscreen', 'frameborder', 'referrerpolicy',
    ],
  }) as string;

  // Post-filter DOM for extra safety and minor fixes
  const div = document.createElement('div');
  div.innerHTML = clean;

  // 1) Tighten <a target="_blank"> rel
  div.querySelectorAll('a[target="_blank"]').forEach((a) => {
    const rel = (a.getAttribute('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);
    const set = new Set(rel);
    set.add('noopener');
    set.add('noreferrer');
    a.setAttribute('rel', Array.from(set).join(' '));
  });

  // 2) Restrict iframes to YouTube (incl. nocookie) and Vimeo only
  div.querySelectorAll('iframe[src]').forEach((el) => {
    const src = el.getAttribute('src') || '';
    if (!(YT.test(src) || VIMEO.test(src))) {
      el.remove();
    }
  });

  // 3) Ensure <video><source src=...> uses https (or strip)
  div.querySelectorAll('video source[src]').forEach((el) => {
    const src = el.getAttribute('src') || '';
    if (!/^https?:\/\//i.test(src)) {
      el.remove();
    }
  });

  // 4) Guard <img> sources; add lazy-loading if missing
  div.querySelectorAll('img[src]').forEach((img) => {
    const src = img.getAttribute('src') || '';
    if (!/^https?:\/\//i.test(src) && !src.startsWith('data:')) {
      img.remove();
      return;
    }
    if (!img.hasAttribute('loading')) {
      img.setAttribute('loading', 'lazy');
    }
  });

  return div.innerHTML;
}
