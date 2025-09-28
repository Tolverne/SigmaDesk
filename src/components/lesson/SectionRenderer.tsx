// src/components/lesson/SectionRenderer.tsx

// Old Start
// import MathBlock from '../MathBlock';
// import {CanvasWorkspace} from '../canvas/CanvasWorkspace';
// Old End

// New Start (imports)
import MathBlock from '../MathBlock';
import CanvasSlot from '../canvas/CanvasSlot';
// New End

type Props = {
  lessonId: string;
  bodyHtml: string;
  slotStart?: number;  // base slot index for this section
};

export function SectionRenderer({bodyHtml, lessonId, slotStart = 0}: Props) {
  // Old Start: tokenization was fine; keep it
  // const tokens: Array<{html?: string, type?: 'student'|'teacher'}> = [];
  // const regex = /<div data-canvas="(student|teacher)"><\/div>/g;
  // let lastIndex = 0, match: RegExpExecArray|null, slotOffset = 0;
  //
  // while ((match = regex.exec(bodyHtml))) {
  //   if (match.index > lastIndex) {
  //     tokens.push({ html: bodyHtml.slice(lastIndex, match.index) });
  //   }
  //   tokens.push({ type: match[1] as 'student'|'teacher' });
  //   lastIndex = match.index + match[0].length;
  // }
  // if (lastIndex < bodyHtml.length) {
  //   tokens.push({ html: bodyHtml.slice(lastIndex) });
  // }
  // Old End

  // New Start: same tokenization (unchanged behavior)
  const tokens: Array<{html?: string, type?: 'student'|'teacher'}> = [];
  const regex = /<div data-canvas="(student|teacher)"><\/div>/g;
  let lastIndex = 0, match: RegExpExecArray|null, slotOffset = 0;

  while ((match = regex.exec(bodyHtml))) {
    if (match.index > lastIndex) {
      tokens.push({ html: bodyHtml.slice(lastIndex, match.index) });
    }
    tokens.push({ type: match[1] as 'student'|'teacher' });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < bodyHtml.length) {
    tokens.push({ html: bodyHtml.slice(lastIndex) });
  }
  // New End

  return (
    <div className="section">
      {tokens.map((t, i) => {
        if (t.html !== undefined) return <MathBlock key={`h-${i}`} html={t.html} />;

        const slotIndex = slotStart + (slotOffset++);

        // Old Start: direct CanvasWorkspace (no role awareness / no teacher carousel)
        // return t.type === 'student'
        //   ? <CanvasWorkspace key={`s-${i}`} lessonId={lessonId} slotIndex={slotIndex} canvasType="student"/>
        //   : <CanvasWorkspace key={`t-${i}`} lessonId={lessonId} slotIndex={slotIndex} canvasType="teacher_example"/>;
        // Old End

        // New Start: delegate to CanvasSlot (handles all 4 behaviors)
        // - Student @ 'student' -> read/write own canvas
        // - Student @ 'teacher_example' -> read-only
        // - Teacher @ 'teacher_example' -> read/write own teacher board
        // - Teacher @ 'student' -> StudentCanvasCarousel showing all students for that slot
        const canvasType = t.type === 'student' ? 'student' : 'teacher_example';
        return (
          <CanvasSlot
            key={`c-${i}`}
            lessonId={lessonId}
            slotIndex={slotIndex}
            canvasType={canvasType as 'student' | 'teacher_example'}
            className="mb-2"
          />
        );
        // New End
      })}
    </div>
  );
}

export default SectionRenderer;
