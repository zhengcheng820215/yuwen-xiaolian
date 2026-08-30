import type { ReinforcementLink } from './reinforcementTypes.ts';

const REVIEWED_AT = '2026-08-29T00:00:00.000Z';

export const KNOWLEDGE_PRACTICE_REINFORCEMENT_LINKS: ReinforcementLink[] = [
  ['rf-link-zy-1-to-2', 'vg-polyphone-context-he', 'q-rf-zy-1', 'q-rf-zy-2', '核对多音字在不同固定词语中的语境读音'],
  ['rf-link-zy-2-to-1', 'vg-polyphone-context-he', 'q-rf-zy-2', 'q-rf-zy-1', '从选项辨析迁移到独立判断'],
  ['rf-link-cy-1-to-2', 'vg-idiom-object-xuxu', 'q-rf-cy-1', 'q-rf-cy-2', '核对成语适用对象在新句中的匹配'],
  ['rf-link-cy-2-to-1', 'vg-idiom-object-xuxu', 'q-rf-cy-2', 'q-rf-cy-1', '从单句判断迁移到多选项辨析'],
  ['rf-link-wy-1-to-2', 'vg-classical-ancient-modern', 'q-rf-wy-1', 'q-rf-wy-2', '在不同篇目中使用语境辨析古今异义'],
  ['rf-link-wy-2-to-1', 'vg-classical-ancient-modern', 'q-rf-wy-2', 'q-rf-wy-1', '从人物关系语境迁移到句意翻译'],
].map(([id, variantGroupId, sourceQuestionId, reinforcementQuestionId, reviewFocus]) => ({
  schemaVersion: 1,
  id,
  contentVersion: 1,
  status: 'approved',
  variantGroupId,
  sourceQuestionId,
  reinforcementQuestionId,
  reviewFocus,
  reviewedAt: REVIEWED_AT,
  reviewNote: 'WP5 首批有向巩固关系，已核对训练目标、答案独立性、难度跨度和答案泄露风险。',
}));

export function listApprovedReinforcementLinks(): ReinforcementLink[] {
  return KNOWLEDGE_PRACTICE_REINFORCEMENT_LINKS
    .filter((link) => link.status === 'approved')
    .map((link) => ({ ...link, applicableMisconceptionCodes: link.applicableMisconceptionCodes ? [...link.applicableMisconceptionCodes] : undefined }));
}
