export function splitReadingMaterialParagraphs(value) {
  return String(value || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

export default function ReadingMaterialText({ children, className = '' }) {
  const paragraphs = splitReadingMaterialParagraphs(children);

  return (
    <div className={['space-y-4', className].filter(Boolean).join(' ')}>
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 24)}`} className="[text-indent:2em]">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
