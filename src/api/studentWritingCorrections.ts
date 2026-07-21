const ENDPOINT = '/__runtime/phase16-3/writing-corrections';

export type WritingCorrectionSuggestion = {
  correctionId: string;
  originalText: string;
  suggestedText: string;
  reason: 'possible_typo';
  confidence: 'high';
  affectsMeaning: false;
  source: 'controlled_llm_candidate';
};

export async function requestStudentWritingCorrections(input: {
  requestId: string;
  answerText: string;
  readingText?: string;
  questionText?: string;
}): Promise<WritingCorrectionSuggestion[]> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) return [];
  const payload = await response.json() as { suggestions?: WritingCorrectionSuggestion[] };
  return Array.isArray(payload.suggestions) ? payload.suggestions.filter(isSuggestion) : [];
}

function isSuggestion(value: unknown): value is WritingCorrectionSuggestion {
  if (!value || typeof value !== 'object') return false;
  const item = value as WritingCorrectionSuggestion;
  return Boolean(item.correctionId && item.originalText && item.suggestedText) &&
    item.reason === 'possible_typo' &&
    item.confidence === 'high' &&
    item.affectsMeaning === false &&
    item.source === 'controlled_llm_candidate';
}
