import { normalizeMaterialTitle } from './materialTitle.ts';

export function formatLearningMaterialHeading(
  title: string | null | undefined,
  author: string | null | undefined,
): string {
  const normalizedTitle = normalizeMaterialTitle(title);
  if (!normalizedTitle) return '阅读材料';

  const normalizedAuthor = String(author || '').trim();
  return normalizedAuthor
    ? `${normalizedTitle} · ${normalizedAuthor}`
    : normalizedTitle;
}
