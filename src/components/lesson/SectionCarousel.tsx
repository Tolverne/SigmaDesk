import { useMemo, useState } from 'react';
import { splitIntoSections } from './latexToHtml';
import SectionRenderer from './SectionRenderer';

export default function SectionCarousel({
  lessonId,
  latexSource,
  classId, // NEW: Accept classId prop
}: {
  lessonId: string;
  latexSource: string;
  classId?: string; // NEW: Optional classId for class-aware context
}) {
  const sections = useMemo(() => splitIntoSections(latexSource), [latexSource]);
  const [idx, setIdx] = useState(0);

  const prev = () => setIdx(i => (i > 0 ? i - 1 : sections.length - 1));
  const next = () => setIdx(i => (i + 1) % sections.length);

  // count how many canvas slots appear *before* this section to compute slotStart
  const slotStart = useMemo(
    () =>
      sections.slice(0, idx).reduce(
        (n, s) => n + ((s.bodyHtml.match(/data-canvas="/g) || []).length),
        0
      ),
    [sections, idx]
  );

  const current = sections[idx];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={prev} aria-label="Previous section">◀</button>
        <h2 className="text-xl font-semibold">{current?.title ?? '—'}</h2>
        <button onClick={next} aria-label="Next section">▶</button>
      </div>

      {current && (
        <SectionRenderer
          key={idx} // remount to simplify MathJax state
          lessonId={lessonId}
          bodyHtml={current.bodyHtml}
          slotStart={slotStart}
          classId={classId} // NEW: Pass classId through
        />
      )}

      <div className="flex justify-center gap-2">
        {sections.map((s, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            className={`w-2.5 h-2.5 rounded-full border ${i === idx ? 'bg-current' : ''}`}
            aria-label={`Go to ${s.title}`}
            title={s.title}
          />
        ))}
      </div>
    </div>
  );
}