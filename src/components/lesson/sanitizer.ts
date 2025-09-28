import DOMPurify from 'dompurify';

const YT = /^(https?:)?\/\/(www\.)?(youtube\.com|youtu\.be)\/.*/i;
const VIMEO = /^(https?:)?\/\/(player\.)?vimeo\.com\/.*/i;

export function sanitizeHtml(input: string) {
  // allow images and a *very* small allowlist of iframe attrs
  const clean = DOMPurify.sanitize(input, {
    ADD_TAGS: ['iframe'],
    ADD_ATTR: ['target','rel','allow','allowfullscreen','frameborder','referrerpolicy']
  }) as string;

  // Post-filter iframes to YT/Vimeo only
  const div = document.createElement('div');
  div.innerHTML = clean;
  div.querySelectorAll('iframe[src]').forEach((el) => {
    const src = el.getAttribute('src') || '';
    if (!(YT.test(src) || VIMEO.test(src))) el.remove();
  });

  return div.innerHTML;
}
