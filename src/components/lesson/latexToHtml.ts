import { sanitizeHtml } from './sanitizer';

export type Section = { title: string; bodyHtml: string };

// \includegraphics[width=...,height=...]{URL} -> <img ...>
function parseIncludeGraphics(src: string) {
  return src.replace(/\\includegraphics(\[[^\]]*\])?\{([^}]+)\}/g, (_m, opt, url) => {
    let width = '', height = '';
    if (opt) {
      const w = /width\s*=\s*([^,\]]+)/.exec(opt)?.[1]; if (w) width  = ` width="${w.replace(/"/g,'')}"`;
      const h = /height\s*=\s*([^,\]]+)/.exec(opt)?.[1]; if (h) height = ` height="${h.replace(/"/g,'')}"`;
    }
    return `<img src="${url}" alt="" loading="lazy"${width}${height} />`;
  });
}

// Optional: \video{EMBED_URL}{Caption} -> <iframe> (use YT/Vimeo embed URLs)
function parseVideo(src: string) {
  return src.replace(/\\video\{([^}]+)\}\{([^}]*)\}/g, (_m, url, cap) =>
    `<figure class="video">
      <iframe src="${url}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe>
      ${cap ? `<figcaption>${cap}</figcaption>` : ''}
    </figure>`
  );
}

export function splitIntoSections(raw: string): Section[] {
  let src = raw.replace(/\r\n/g, '\n');

  // Media first (so sanitizer sees proper tags)
  src = parseIncludeGraphics(src);
  src = parseVideo(src);

  // \href{url}{label} -> <a target=_blank rel=noopener>
  src = src.replace(/\\href\{([^}]+)\}\{([^}]+)\}/g,
    (_m, url, label) => `<a href="${url}" target="_blank" rel="noopener">${label}</a>`);

  // structural tags
  src = src
    .replace(/\\questions/g, '<div class="questions">')
    .replace(/\\end\{questions\}/g, '</div>')
    .replace(/\\parts/g, '<ol class="parts">')
    .replace(/\\end\{parts\}/g, '</ol>')
    .replace(/\\question\b/g, '<div class="question">')
    // close question at safe boundaries
    .replace(/(?=(\\question|\\section\{|\\end\{questions\}|$))/g, '</div>')

    // canvas mount points
    .replace(/\\workskip/g, '<div data-canvas="student"></div>')
    .replace(/\\bigskip/g,  '<div data-canvas="teacher"></div>');

  // split on \section{Title}
  const chunks = src.split(/\\section\{([^}]+)\}/g); // ['', title1, body1, title2, body2, ...]
  const sections: Section[] = [];

  if (chunks[0].trim()) {
    sections.push({ title: 'Overview', bodyHtml: sanitizeHtml(chunks[0]) });
  }
  for (let i = 1; i < chunks.length; i += 2) {
    const title = (chunks[i]||'').trim() || `Section ${sections.length + 1}`;
    const body  = chunks[i + 1] || '';
    sections.push({ title, bodyHtml: sanitizeHtml(body) });
  }

  return sections;
}
