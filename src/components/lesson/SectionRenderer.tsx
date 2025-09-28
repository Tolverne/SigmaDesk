import MathBlock from '../MathBlock'; // you created this in Step 1 (../ because MathBlock is in components/)
import CanvasWorkspace from '../canvas/CanvasWorkspace';

type Props = {
  lessonId: string;
  bodyHtml: string;
  slotStart?: number;             // base slot index for this section
};

export default function SectionRenderer({ lessonId, bodyHtml, slotStart = 0 }: Props) {
  // Tokenize around canvas placeholders
  const tokens: Array<{ html?: string, type?: 'student' | 'teacher' }> = [];
  const re = /<div data-canvas="(student|teacher)"><\/div>/g;

  let last = 0, m: RegExpExecArray | null, offs = 0;
  while ((m = re.exec(bodyHtml))) {
    if (m.index > last) tokens.push({ html: bodyHtml.slice(last, m.index) });
    tokens.push({ type: m[1] as 'student' | 'teacher' });
    last = m.index + m[0].length;
  }
  if (last < bodyHtml.length) tokens.push({ html: bodyHtml.slice(last) });

  return (
    <div className="section">
      {tokens.map((t, i) => {
        if (t.html !== undefined) return <MathBlock key={`h-${i}`} html={t.html} />;
        const slotIndex = slotStart + (offs++);
        const canvasType = t.type === 'student' ? 'student' : 'teacher_example';
        return (
          <CanvasWorkspace
            key={`c-${i}`}
            lessonId={lessonId}
            slotIndex={slotIndex}
            canvasType={canvasType as 'student' | 'teacher_example'}
          />
        );
      })}
    </div>
  );
}
