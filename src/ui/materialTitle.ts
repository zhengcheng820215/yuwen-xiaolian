export function formatMaterialTitle(value: string | null | undefined): string {
  let title = String(value || '').trim();

  while (title.startsWith('《') && title.endsWith('》') && title.length > 2) {
    title = title.slice(1, -1).trim();
  }

  return title ? `《${title}》` : '未命名材料';
}
