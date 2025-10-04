// src/components/lesson/SectionRenderer.tsx

import MathBlock from '../MathBlock';
import CanvasSlot from '../canvas/CanvasSlot';

type Props = {
  lessonId: string;
  bodyHtml: string;
  slotStart?: number;  // base slot index for this section
};

export function SectionRenderer({bodyHtml, lessonId, slotStart = 0}: Props) {
  // Updated regex to handle 'student' and 'class' canvas types
  const tokens: Array<{html?: string, type?: 'student' | 'class'}> = [];
  const regex = /<div data-canvas="(student|class)"><\/div>/g;
  let lastIndex = 0, match: RegExpExecArray | null, slotOffset = 0;

  while ((match = regex.exec(bodyHtml))) {
    if (match.index > lastIndex) {
      tokens.push({ html: bodyHtml.slice(lastIndex, match.index) });
    }
    tokens.push({ type: match[1] as 'student' | 'class' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < bodyHtml.length) {
    tokens.push({ html: bodyHtml.slice(lastIndex) });
  }

  return (
    <div className="section">
      {tokens.map((t, i) => {
        if (t.html !== undefined) return <MathBlock key={`h-${i}`} html={t.html} />;

        const slotIndex = slotStart + (slotOffset++);

        // Map token type to canvas type
        // - Student @ 'student' -> read/write own canvas
        // - Student @ 'class' -> read-only view of class canvas
        // - Teacher @ 'class' -> read/write class canvas (for their assigned class)
        // - Teacher @ 'student' -> StudentCanvasCarousel showing all students for that slot
        const canvasType = t.type === 'student' ? 'student' : 'class';
        return (
          <CanvasSlot
            key={`c-${i}`}
            lessonId={lessonId}
            slotIndex={slotIndex}
            canvasType={canvasType}
            className="mb-2"
          />
        );
      })}
    </div>
  );
}

export default SectionRenderer;