// src/components/lesson/latexToHtml.ts
import { sanitizeHtml } from './sanitizer';

export type Section = { title: string; bodyHtml: string };

// New Start: helpers for media macros
const YT_HOST = /^(https?:)?\/\/(www\.)?(youtube\.com|youtu\.be|youtube\-nocookie\.com)\//i;
const VIMEO_HOST = /^(https?:)?\/\/(player\.)?vimeo\.com\//i;

function toYouTubeEmbed(u: string): string {
  const s = u.trim();
  // raw id?
  const idOnly = s.match(/^[\w-]{11}$/)?.[0];
  let id = idOnly || '';
  if (!id) {
    const m1 = s.match(/[?&]v=([\w-]{11})/);
    const m2 = s.match(/youtu\.be\/([\w-]{11})/);
    const m3 = s.match(/embed\/([\w-]{11})/);
    id = m1?.[1] || m2?.[1] || m3?.[1] || '';
  }
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : s;
}

function toVimeoEmbed(u: string): string {
  const m = u.trim().match(/vimeo\.com\/(\d+)|^(\d{6,})$/);
  const id = m ? (m[1] || m[2]) : '';
  return id ? `https://player.vimeo.com/video/${id}` : u;
}

function isDirectVideo(u: string): boolean {
  return /\.(mp4|webm|ogv?|m4v)(\?|#|$)/i.test(u);
}
// New End

// \includegraphics[width=...,height=...]{URL} -> <img ...>
// Old Start
// function parseIncludeGraphics(src: string) {
//   return src.replace(/\\includegraphics(\[[^\]]*\])?\{([^}]+)\}/g, (_m, opt, url) => {
//     let width = '', height = '';
//     if (opt) {
//       const w = /width\s*=\s*([^,\]]+)/.exec(opt)?.[1]; if (w) width  = ` width="${w.replace(/"/g,'')}"`;
//       const h = /height\s*=\s*([^,\]]+)/.exec(opt)?.[1]; if (h) height = ` height="${h.replace(/"/g,'')}"`;
//     }
//     return `<img src="${url}" alt="" loading="lazy"${width}${height} />`;
//   });
// }
// Old End
// New Start
// at top of file
function toDirectImageURL(url: string): string {
  // 1) If it’s already a direct file (upload.wikimedia.org), keep it
  if (/^https?:\/\/upload\.wikimedia\.org\//i.test(url)) return url;

  // 2) Wikipedia "media page" → Special:FilePath/<filename>
  // Examples we try to catch:
  //   https://en.wikipedia.org/wiki/Foo#/media/File:Bar.png
  //   https://en.wikipedia.org/wiki/File:Bar.png
  const fileMatch =
    url.match(/(?:#\/media\/File:|\/wiki\/File:)([^?#]+)/i);

  if (fileMatch && fileMatch[1]) {
    const filename = decodeURIComponent(fileMatch[1]);
    return `https://en.wikipedia.org/wiki/Special:FilePath/${filename}`;
  }

  // 3) Otherwise leave as-is
  return url;
}

// \includegraphics[width=...,height=...]{URL} -> <img ...>
function parseIncludeGraphics(src: string) {
  return src.replace(/\\includegraphics(\[[^\]]*\])?\{([^}]+)\}/g, (_m, opt, rawUrl) => {
    const url = toDirectImageURL(rawUrl.trim());
    let style = 'max-width:100%;';
    if (opt) {
      const w = /width\s*=\s*([^,\]]+)/.exec(opt)?.[1]?.replace(/"/g, '');
      const h = /height\s*=\s*([^,\]]+)/.exec(opt)?.[1]?.replace(/"/g, '');
      if (w) style += `width:${w};`;     // supports %, px, etc.
      if (h) style += `height:${h};`;
    }
    const alt = (url.split('/').pop() || '').split('?')[0];
    return `<img src="${url}" alt="${alt}" loading="lazy" style="${style}" />`;
  });
}

// New End

// Optional: \video{URL}[Caption] (we’ll accept either {url}{caption} OR just {url})
// Old Start
// function parseVideo(src: string) {
//   return src.replace(/\\video\{([^}]+)\}\{([^}]*)\}/g, (_m, url, cap) =>
//     `<figure class="video">
//       <iframe src="${url}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
//               allowfullscreen frameborder="0" referrerpolicy="strict-origin-when-cross-origin"></iframe>
//       ${cap ? `<figcaption>${cap}</figcaption>` : ''}
//     </figure>`
//   );
// }
// Old End
// New Start
function parseVideo(src: string) {
  return src
    // \video{url}{caption}
    .replace(/\\video\{([^}]+)\}\{([^}]*)\}/g, (_m, url, cap) => {
      const u = url.trim();
      // If YouTube/Vimeo link, convert to iframe; if direct file, use <video>
      if (YT_HOST.test(u)) {
        const embed = toYouTubeEmbed(u);
        return `<figure class="video my-3">
  <div class="aspect-video w-full">
    <iframe class="w-full h-full" src="${embed}" title="Video" frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
  </div>
  ${cap ? `<figcaption class="text-sm text-gray-600 mt-2 text-center">${cap}</figcaption>` : ''}
</figure>`;
      }
      if (VIMEO_HOST.test(u)) {
        const embed = toVimeoEmbed(u);
        return `<figure class="video my-3">
  <div class="aspect-video w-full">
    <iframe class="w-full h-full" src="${embed}" title="Video" frameborder="0"
      allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
  </div>
  ${cap ? `<figcaption class="text-sm text-gray-600 mt-2 text-center">${cap}</figcaption>` : ''}
</figure>`;
      }
      if (isDirectVideo(u)) {
        return `<figure class="video my-3">
  <video controls playsinline style="width:100%;max-width:100%;"><source src="${u}"/></video>
  ${cap ? `<figcaption class="text-sm text-gray-600 mt-2 text-center">${cap}</figcaption>` : ''}
</figure>`;
      }
      // Fallback: treat as iframe (e.g., already an embed URL)
      return `<figure class="video my-3">
  <div class="aspect-video w-full">
    <iframe class="w-full h-full" src="${u}" title="Video" frameborder="0" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
  </div>
  ${cap ? `<figcaption class="text-sm text-gray-600 mt-2 text-center">${cap}</figcaption>` : ''}
</figure>`;
    })
    // Also support \video{url} with no caption
    .replace(/\\video\{([^}]+)\}/g, (_m, url) => {
      const u = url.trim();
      if (YT_HOST.test(u)) {
        const embed = toYouTubeEmbed(u);
        return `<div class="aspect-video w-full my-3">
  <iframe class="w-full h-full" src="${embed}" title="Video" frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>`;
      }
      if (VIMEO_HOST.test(u)) {
        const embed = toVimeoEmbed(u);
        return `<div class="aspect-video w-full my-3">
  <iframe className="w-full h-full" src="${embed}" title="Video" frameborder="0"
    allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
</div>`;
      }
      if (isDirectVideo(u)) {
        return `<video controls playsinline style="width:100%;max-width:100%;"><source src="${u}"/></video>`;
      }
      return `<div class="aspect-video w-full my-3">
  <iframe class="w-full h-full" src="${u}" title="Video" frameborder="0" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
</div>`;
    });
}
// New End

// New Start: explicit \youtube and \vimeo macros
function parseYouTube(src: string) {
  return src.replace(/\\youtube\{([^}]+)\}/g, (_m, idOrUrl) => {
    const embed = toYouTubeEmbed(idOrUrl);
    return `<div class="aspect-video w-full my-3">
  <iframe class="w-full h-full" src="${embed}" title="YouTube video" frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
    referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
</div>`;
  });
}

function parseVimeo(src: string) {
  return src.replace(/\\vimeo\{([^}]+)\}/g, (_m, idOrUrl) => {
    const embed = toVimeoEmbed(idOrUrl);
    return `<div class="aspect-video w-full my-3">
  <iframe class="w-full h-full" src="${embed}" title="Vimeo video" frameborder="0"
    allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>
</div>`;
  });
}
// New End

export function splitIntoSections(raw: string): Section[] {
  let src = raw.replace(/\r\n/g, '\n');

  // Media first (so sanitizer sees proper tags)
  // Old Start
  // src = parseIncludeGraphics(src);
  // src = parseVideo(src);
  // Old End
  // New Start
  src = parseIncludeGraphics(src);
  src = parseYouTube(src);
  src = parseVimeo(src);
  src = parseVideo(src);
  // New End

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
    .replace(/\\bigskip/g,  '<div data-canvas="class"></div>');

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
