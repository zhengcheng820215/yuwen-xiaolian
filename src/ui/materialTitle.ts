export function normalizeMaterialTitle(value: string | null | undefined): string {
  let title = String(value || '').trim();

  while (title.startsWith('《') && title.endsWith('》') && title.length > 2) {
    title = title.slice(1, -1).trim();
  }

  if (!title) return '';
  return /《[^《》]+》/.test(title) ? title : `《${title}》`;
}

export function formatMaterialTitle(value: string | null | undefined): string {
  return normalizeMaterialTitle(value) || '未命名材料';
}
