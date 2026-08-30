import type { KnowledgeQuestion } from '../questions/knowledgeQuestionTypes.ts';
import { REINFORCEMENT_LINK_STATUSES, type ReinforcementLink } from './reinforcementTypes.ts';

export type ReinforcementLinkValidationIssue = { severity: 'error' | 'warning'; code: string; path: string; message: string; linkId?: string };
export type ReinforcementLinkValidationResult = { passed: boolean; issues: ReinforcementLinkValidationIssue[] };
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export function validateReinforcementLinks(links: ReinforcementLink[], questions: KnowledgeQuestion[]): ReinforcementLinkValidationResult {
  const issues: ReinforcementLinkValidationIssue[] = [];
  const byId = new Map(questions.map((question) => [question.id, question]));
  const ids = new Set<string>();
  const triples = new Set<string>();
  const add = (code: string, path: string, message: string, linkId?: string, severity: 'error' | 'warning' = 'error') => issues.push({ severity, code, path, message, linkId });
  for (const [index, link] of links.entries()) {
    const path = `links.${index}`;
    if (link.schemaVersion !== 1) add('link.schema_version_invalid', `${path}.schemaVersion`, 'Link Schema版本必须为1。', link.id);
    if (!link.id || !ID_PATTERN.test(link.id)) add('link.id_invalid', `${path}.id`, 'Link ID非法。', link.id);
    if (ids.has(link.id)) add('link.id_duplicate', `${path}.id`, 'Link ID重复。', link.id);
    ids.add(link.id);
    if (!Number.isInteger(link.contentVersion) || link.contentVersion < 1) add('link.version_invalid', `${path}.contentVersion`, 'Link内容版本非法。', link.id);
    if (!REINFORCEMENT_LINK_STATUSES.includes(link.status)) add('link.status_invalid', `${path}.status`, 'Link状态非法。', link.id);
    const triple = `${link.variantGroupId}|${link.sourceQuestionId}|${link.reinforcementQuestionId}`;
    if (triples.has(triple)) add('link.triple_duplicate', path, 'source、target和group三元组重复。', link.id);
    triples.add(triple);
    if (link.sourceQuestionId === link.reinforcementQuestionId) add('link.self_reference', path, 'source与target不得相同。', link.id);
    const source = byId.get(link.sourceQuestionId);
    const target = byId.get(link.reinforcementQuestionId);
    if (!source) add('link.source_missing', `${path}.sourceQuestionId`, 'source题不存在。', link.id);
    if (!target) add('link.target_missing', `${path}.reinforcementQuestionId`, 'target题不存在。', link.id);
    if (link.status === 'approved') {
      if (source?.contentStatus !== 'approved') add('link.source_not_approved', `${path}.sourceQuestionId`, 'approved Link的source必须approved。', link.id);
      if (target?.contentStatus !== 'approved') add('link.target_not_approved', `${path}.reinforcementQuestionId`, 'approved Link的target必须approved。', link.id);
      if (!link.reviewedAt || Number.isNaN(Date.parse(link.reviewedAt)) || !link.reviewFocus.trim() || !link.reviewNote?.trim()) add('link.review_required', path, 'approved Link缺少完整审核记录。', link.id);
    }
    if (source && target) {
      if (!link.variantGroupId || source.variantGroupId !== link.variantGroupId || target.variantGroupId !== link.variantGroupId) add('link.variant_group_mismatch', `${path}.variantGroupId`, 'Link与两题变式组不一致。', link.id);
      if (source.knowledgePoint !== target.knowledgePoint) add('link.knowledge_point_mismatch', path, 'source与target知识点不一致。', link.id);
      if (source.grade !== target.grade || source.semester !== target.semester) add('link.scope_mismatch', path, 'source与target年级学期不一致。', link.id);
      const knownCodes = new Set(Object.values(source.misconceptionByAnswer || {}).map((item) => item.code));
      for (const code of link.applicableMisconceptionCodes || []) if (!knownCodes.has(code)) add('link.misconception_unknown', `${path}.applicableMisconceptionCodes`, 'Link引用source未定义的错因。', link.id);
    }
  }
  return { passed: !issues.some((item) => item.severity === 'error'), issues };
}

export function summarizeApprovedVariantCoverage(links: ReinforcementLink[], questions: KnowledgeQuestion[]) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const approved = links.filter((link) => link.status === 'approved' && byId.get(link.sourceQuestionId)?.contentStatus === 'approved' && byId.get(link.reinforcementQuestionId)?.contentStatus === 'approved');
  const groups = new Set(approved.map((link) => link.variantGroupId));
  const sources = approved.map((link) => byId.get(link.sourceQuestionId)).filter(Boolean) as KnowledgeQuestion[];
  return { approvedLinkCount: approved.length, variantGroupCount: groups.size, categoryCount: new Set(sources.map((q) => q.category)).size, knowledgePointCount: new Set(sources.map((q) => q.knowledgePoint)).size };
}
