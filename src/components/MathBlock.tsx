import { useEffect, useRef } from 'react';

declare global { interface Window { MathJax?: any } }

export default function MathBlock({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !window.MathJax) return;
    window.MathJax.typesetPromise([el]).catch(() => { /* no-op */ });
  }, [html]);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
