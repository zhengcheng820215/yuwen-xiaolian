export type MaterialEvidenceBoundaryKind =
  | 'local'
  | 'whole_text'
  | 'open_evidence'
  | 'mixed'
  | 'generic'
  | 'missing';

export type MaterialEvidenceBoundary = {
  kind: MaterialEvidenceBoundaryKind;
  paragraphCount: number;
  hasInvalidParagraphReference: boolean;
  hasLocalBoundary: boolean;
  hasWholeTextBoundary: boolean;
  hasOpenEvidenceBoundary: boolean;
  refersToMaterial: boolean;
};

export function assessMaterialEvidenceBoundary(
  stem: string,
  materialContent: string,
): MaterialEvidenceBoundary {
  const normalizedStem = normalizeText(stem);
  const normalizedContent = normalizeText(materialContent);
  const paragraphCount = countMaterialParagraphs(materialContent);
  const paragraphReferences = extractParagraphReferences(stem);
  const hasInvalidParagraphReference = paragraphReferences.some(
    ({ start, end }) => start < 1 || end < start || end > paragraphCount,
  );
  const hasValidParagraphReference = paragraphReferences.some(
    ({ start, end }) => start >= 1 && end >= start && end <= paragraphCount,
  );
  const hasQuotedAnchor = extractQuotedPhrases(stem).some(
    (anchor) => anchor.length >= 3 && normalizedContent.includes(normalizeText(anchor)),
  );
  const hasTextAnchor = longestCommonChineseRun(normalizedStem, normalizedContent) >= 4;
  const hasLocalBoundary = hasValidParagraphReference || hasQuotedAnchor || hasTextAnchor;
  const hasWholeTextBoundary = (
    /(?:结合|根据|依据|通读)(?:《[^》]{1,80}》)?(?:全文|全篇|整篇|通篇|文章整体)/.test(normalizedStem) ||
    /(?:从|在)(?:《[^》]{1,80}》)?(?:全文|全篇|整篇|通篇)中/.test(normalizedStem)
  );
  const hasOpenEvidenceBoundary = (
    /(任选|选取|找出|列举|举出).{0,12}(一|二|两|三|\d+)?\s*(处|个|项|例).{0,12}(细节|语句|情节|证据|描写|内容)/.test(normalizedStem)
  );
  const refersToMaterial = (
    /(结合(材料|全文|上下文)|根据(材料|全文|文中)|文中|文章|原文|这一(动作|细节|语句|段落))/.test(normalizedStem) ||
    /《[^》]{1,80}》/.test(stem)
  );

  const explicitKinds = [
    hasLocalBoundary,
    hasWholeTextBoundary,
    hasOpenEvidenceBoundary,
  ].filter(Boolean).length;
  const kind: MaterialEvidenceBoundaryKind = explicitKinds > 1
    ? 'mixed'
    : hasLocalBoundary
      ? 'local'
      : hasWholeTextBoundary
        ? 'whole_text'
        : hasOpenEvidenceBoundary
          ? 'open_evidence'
          : refersToMaterial
            ? 'generic'
            : 'missing';

  return {
    kind,
    paragraphCount,
    hasInvalidParagraphReference,
    hasLocalBoundary,
    hasWholeTextBoundary,
    hasOpenEvidenceBoundary,
    refersToMaterial,
  };
}

function countMaterialParagraphs(content: string): number {
  return content
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .length;
}

function extractParagraphReferences(
  text: string,
): Array<{ start: number; end: number }> {
  return [...text.matchAll(/第\s*(\d+)\s*(?:[-—–至到]\s*第?\s*(\d+)\s*)?段/g)]
    .map((match) => ({
      start: Number(match[1]),
      end: Number(match[2] || match[1]),
    }));
}

function extractQuotedPhrases(value: string): string[] {
  const phrases: string[] = [];
  for (const match of value.matchAll(/[“"]([^”"]+)[”"]/g)) {
    if (match[1]) phrases.push(match[1].trim());
  }
  return phrases;
}

function longestCommonChineseRun(left: string, right: string): number {
  const leftText = [...left].filter((char) => /[\u4e00-\u9fff]/.test(char)).join('');
  const rightText = [...right].filter((char) => /[\u4e00-\u9fff]/.test(char)).join('');
  if (!leftText || !rightText) return 0;

  let longest = 0;
  let previous = new Array(rightText.length + 1).fill(0) as number[];
  for (let leftIndex = 1; leftIndex <= leftText.length; leftIndex += 1) {
    const current = new Array(rightText.length + 1).fill(0) as number[];
    for (let rightIndex = 1; rightIndex <= rightText.length; rightIndex += 1) {
      if (leftText[leftIndex - 1] === rightText[rightIndex - 1]) {
        current[rightIndex] = previous[rightIndex - 1] + 1;
        longest = Math.max(longest, current[rightIndex]);
      }
    }
    previous = current;
  }
  return longest;
}

function normalizeText(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(/[\s，。！？；：、“”‘’（）,.!?;:'"()[\]{}]/g, '');
}
