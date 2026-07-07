import type {
  DiagnosisInput,
  DiagnosisResult,
  OpenResponseAnswerStatus,
  OpenResponseRubricItem,
  OpenResponseScoreBand,
} from '../schemas/diagnosis.schema.ts';

export type OpenResponseRubricEvaluation = Pick<
  DiagnosisResult,
  | 'answerStatus'
  | 'scoreBand'
  | 'correct'
  | 'rubricItems'
  | 'matchedRubricItems'
  | 'missingRubricItems'
  | 'surfaceError'
  | 'rootCause'
  | 'errorType'
  | 'abilityEvidence'
  | 'diagnosisSummary'
  | 'nextTraining'
  | 'confidence'
>;

export function evaluateOpenResponseRubric(
  input: DiagnosisInput,
  mainAbility: string,
  relatedAbilities: string[],
): OpenResponseRubricEvaluation {
  const overlap = keywordOverlap(input.referenceAnswer, input.studentAnswer);
  const isEmpty = input.studentAnswer.trim().length === 0;
  const exactOrHighMatch = isOpenResponseCorrect(input.referenceAnswer, input.studentAnswer, overlap);
  const hasEvidenceSignal = /原文|文中|依据|因为|从.*看出|第.*段/.test(input.studentAnswer);
  const rubricItems = buildRubricItems(input, mainAbility, overlap, hasEvidenceSignal, exactOrHighMatch);
  const matchedRubricItems = rubricItems.filter((item) => item.matched).map((item) => item.id);
  const missingRubricItems = rubricItems.filter((item) => item.required && !item.matched).map((item) => item.id);
  const requiredItems = rubricItems.filter((item) => item.required);
  const requiredMatchedCount = requiredItems.filter((item) => item.matched).length;
  const answerStatus = inferAnswerStatus(isEmpty, requiredItems.length, requiredMatchedCount);
  const scoreBand = inferScoreBand(answerStatus, requiredItems.length, requiredMatchedCount);
  const correct = answerStatus === 'fully_meets';
  const rootCause = inferRootCauseFromRubric(mainAbility, answerStatus, missingRubricItems);
  const errorType = correct ? '待验证' : abilityToErrorType(mainAbility);

  return {
    answerStatus,
    scoreBand,
    correct,
    rubricItems,
    matchedRubricItems,
    missingRubricItems,
    surfaceError: inferSurfaceError(answerStatus),
    rootCause,
    errorType,
    abilityEvidence: buildAbilityEvidence(
      mainAbility,
      relatedAbilities,
      overlap,
      rubricItems,
      answerStatus,
    ),
    diagnosisSummary: buildDiagnosisSummary(mainAbility, answerStatus, scoreBand),
    nextTraining: inferNextTraining(mainAbility, answerStatus, missingRubricItems),
    confidence: inferConfidence(answerStatus, overlap),
  };
}

function buildRubricItems(
  input: DiagnosisInput,
  mainAbility: string,
  overlap: number,
  hasEvidenceSignal: boolean,
  exactOrHighMatch: boolean,
): OpenResponseRubricItem[] {
  const rubricTemplate = getRubricTemplate(input, mainAbility);

  if (exactOrHighMatch) {
    return rubricTemplate.map((item) => ({
      ...item,
      matched: true,
      evidence: '学生答案与参考答案高度一致，视为满足该能力要点。',
    }));
  }

  return rubricTemplate.map((item) => {
    const matched = matchRubricItem(item.id, mainAbility, overlap, hasEvidenceSignal, input.studentAnswer);

    return {
      ...item,
      matched,
      evidence: matched ? inferMatchedEvidence(item.id, item.ability) : undefined,
      missingReason: matched ? undefined : inferMissingReason(item.id, item.ability),
    };
  });
}

function getRubricTemplate(
  input: DiagnosisInput,
  mainAbility: string,
): Omit<OpenResponseRubricItem, 'matched' | 'evidence' | 'missingReason'>[] {
  const metadataRubric = input.questionMetadata?.rubric;

  if (metadataRubric && metadataRubric.length > 0) {
    return metadataRubric.map((item, index) => ({
      id: item.id || inferRubricId(item.name, mainAbility, index),
      label: item.description ? `${item.name}：${item.description}` : item.name,
      ability: item.ability || inferRubricAbility(item.name, mainAbility),
      required: item.required ?? true,
    }));
  }

  if (mainAbility === '概括') {
    return [
      { id: 'main_object', label: '是否说清主要对象', ability: '信息提取', required: true },
      { id: 'core_event', label: '是否概括核心事件', ability: '概括', required: true },
      { id: 'theme_or_emotion', label: '是否提炼主旨、情感或意义', ability: '理解', required: true },
      { id: 'concise_expression', label: '是否删除无关细节并表达简洁', ability: '表达', required: false },
    ];
  }

  if (mainAbility === '分析') {
    return [
      { id: 'analysis_target', label: '是否明确分析对象', ability: '理解', required: true },
      { id: 'text_evidence', label: '是否提供文本依据', ability: '信息提取', required: true },
      { id: 'analysis_explanation', label: '是否说明依据如何支持结论', ability: '分析', required: true },
      { id: 'complete_expression', label: '是否表达完整、有层次', ability: '表达', required: false },
    ];
  }

  if (mainAbility === '推理') {
    return [
      { id: 'clue_extraction', label: '是否提取文本线索', ability: '信息提取', required: true },
      { id: 'context_understanding', label: '是否理解上下文关系', ability: '理解', required: true },
      { id: 'inference_chain', label: '是否形成依据到结论的推理链', ability: '推理', required: true },
      { id: 'avoid_over_inference', label: '是否避免脱离文本的过度推断', ability: '推理', required: false },
    ];
  }

  if (mainAbility === '信息提取') {
    return [
      { id: 'task_scope', label: '是否识别题目要求和限定条件', ability: '理解', required: true },
      { id: 'key_text', label: '是否定位关键文本信息', ability: '信息提取', required: true },
      { id: 'complete_points', label: '是否提取完整要点', ability: '信息提取', required: true },
      { id: 'clear_expression', label: '是否清晰呈现提取结果', ability: '表达', required: false },
    ];
  }

  if (mainAbility === '理解') {
    return [
      { id: 'literal_meaning', label: '是否理解词句表层含义', ability: '理解', required: true },
      { id: 'context_relation', label: '是否结合上下文理解语境', ability: '理解', required: true },
      { id: 'deep_meaning', label: '是否说明深层含义或情感变化', ability: '理解', required: true },
      { id: 'clear_expression', label: '是否清晰表达理解结果', ability: '表达', required: false },
    ];
  }

  return [
    { id: 'answer_relevance', label: '是否回应题目要求', ability: '理解', required: true },
    { id: 'text_evidence', label: '是否提供文本依据', ability: '信息提取', required: true },
    { id: 'complete_expression', label: '是否完整表达思考结果', ability: '表达', required: true },
  ];
}

function inferRubricId(name: string, mainAbility: string, index: number): string {
  if (/对象|人物|主体/.test(name)) return 'main_object';
  if (/事件|经过|经历|内容/.test(name)) return 'core_event';
  if (/主题|主旨|情感|中心|意义/.test(name)) return 'theme_or_emotion';
  if (/象征|深层/.test(name)) return 'symbolic_meaning';
  if (/表达|完整|简洁/.test(name)) return 'complete_expression';
  if (/依据|文本|原文/.test(name)) return 'text_evidence';
  if (/推理链|推断过程|原因/.test(name)) return 'inference_chain';
  if (/线索/.test(name)) return 'clue_extraction';
  if (/语境|上下文/.test(name)) return 'context_understanding';
  return `${mainAbility}_rubric_${index + 1}`;
}

function inferRubricAbility(name: string, mainAbility: string): string {
  if (/对象|人物|依据|文本|原文|线索/.test(name)) return '信息提取';
  if (/事件|经过|经历|内容/.test(name)) return '概括';
  if (/象征|深层/.test(name)) return '理解';
  if (/主题|主旨|情感|中心|意义|语境|上下文/.test(name)) return '理解';
  if (/推理链|推断过程|原因/.test(name)) return '推理';
  if (/表达|完整|简洁/.test(name)) return '表达';
  return mainAbility;
}

function matchRubricItem(
  id: string,
  mainAbility: string,
  overlap: number,
  hasEvidenceSignal: boolean,
  studentAnswer: string,
): boolean {
  const answerLength = studentAnswer.trim().length;

  if (answerLength === 0) return false;
  if (id === 'main_object' || id === 'analysis_target' || id === 'literal_meaning' || id === 'task_scope') return overlap >= 0.05;
  if (id === 'core_event' || id === 'context_understanding' || id === 'answer_relevance') return overlap >= 0.18;
  if (id === 'theme_or_emotion' || id === 'deep_meaning' || id === 'symbolic_meaning') return overlap >= 0.45;
  if (id === 'literal_to_symbolic') return /不是.*灯光|不是.*真正|不只是.*灯|象征|深层|牵挂/.test(studentAnswer);
  if (id === 'emotional_understanding') return /爱|关爱|牵挂|感动|感受|理解/.test(studentAnswer);
  if (id === 'text_evidence' || id === 'clue_extraction' || id === 'key_text') return hasEvidenceSignal || overlap >= 0.45;
  if (id === 'analysis_explanation') return hasEvidenceSignal && overlap >= 0.35;
  if (id === 'inference_chain') return hasEvidenceSignal && overlap >= 0.35;
  if (id === 'complete_points') return overlap >= 0.45;
  if (id === 'concise_expression') return mainAbility === '概括' && answerLength <= 80 && overlap >= 0.18;
  if (id === 'complete_expression' || id === 'clear_expression') return answerLength >= 8;
  if (id === 'avoid_over_inference') return overlap >= 0.25;

  return overlap >= 0.25;
}

function inferAnswerStatus(
  isEmpty: boolean,
  requiredCount: number,
  requiredMatchedCount: number,
): OpenResponseAnswerStatus {
  if (isEmpty) return 'insufficient_evidence';
  if (requiredMatchedCount === requiredCount) return 'fully_meets';
  if (requiredMatchedCount === 0) return 'does_not_meet';
  return 'partially_meets';
}

function inferScoreBand(
  answerStatus: OpenResponseAnswerStatus,
  requiredCount: number,
  requiredMatchedCount: number,
): OpenResponseScoreBand {
  if (answerStatus === 'insufficient_evidence') return 'invalid';
  if (answerStatus === 'fully_meets') return 'high';
  if (answerStatus === 'partially_meets') return 'medium';
  if (answerStatus === 'does_not_meet') return 'low';
  return 'invalid';
}

function inferSurfaceError(answerStatus: OpenResponseAnswerStatus): string {
  const map: Record<OpenResponseAnswerStatus, string> = {
    fully_meets: '学生答案完整满足开放题主要作答要求',
    partially_meets: '学生答案部分满足要求，但存在关键能力要点缺失',
    does_not_meet: '学生答案未完成本题主要能力任务',
    insufficient_evidence: '学生答案证据不足，暂不能形成稳定能力判断',
  };

  return map[answerStatus];
}

function inferRootCauseFromRubric(
  mainAbility: string,
  answerStatus: OpenResponseAnswerStatus,
  missingRubricItems: string[],
): string {
  if (answerStatus === 'fully_meets') {
    return '无补弱型 rootCause：学生答案已达到本题开放作答要求。';
  }

  if (answerStatus === 'insufficient_evidence') {
    return '学生答案证据不足，需要补充作答后再判断真实能力短板。';
  }

  if (mainAbility === '概括' && missingRubricItems.includes('core_event')) {
    return '学生并非没有理解文本情感，而是没有概括核心事件，答案停留在感受或局部判断，缺少“谁做了什么、经历了什么”的主要内容。';
  }

  if (missingRubricItems.includes('theme_or_emotion')) {
    return '学生能写出部分内容，但核心信息筛选与主旨提炼不稳定。';
  }

  if (missingRubricItems.includes('key_text') || missingRubricItems.includes('complete_points')) {
    return '学生可能尚未定位到关键文本信息，真实短板优先追溯为信息提取或题意理解不稳定。';
  }

  if (missingRubricItems.includes('literal_to_symbolic') && !missingRubricItems.includes('emotional_understanding')) {
    return '学生已理解句子表达的情感主题，但没有解释关键词的深层含义，尚未完成从字面含义到象征含义的转换。';
  }

  if (missingRubricItems.includes('literal_to_symbolic') || missingRubricItems.includes('symbolic_meaning')) {
    return '学生停留在字面理解，尚未完成语境推理，未能说明词句背后的象征含义或人物情感。';
  }

  if (missingRubricItems.includes('context_relation') || missingRubricItems.includes('deep_meaning')) {
    return '学生在理解能力路径上已有作答尝试，但对词句含义或语境关系的把握不稳定。';
  }

  if (missingRubricItems.includes('text_evidence')) {
    return '学生能够给出部分判断，但缺少文本依据支撑，真实短板可能是依据提取与表达组织不足。';
  }

  if (missingRubricItems.includes('inference_chain')) {
    return '学生能找到部分线索，但尚未形成完整的文本依据到结论的推理链。';
  }

  return `学生在「${mainAbility}」能力路径上存在关键要点缺失，需要通过 rubric 证据继续验证。`;
}

function inferNextTraining(
  mainAbility: string,
  answerStatus: OpenResponseAnswerStatus,
  missingRubricItems: string[],
): string {
  if (answerStatus === 'fully_meets') return '进入下一题 / 提高难度 / 迁移验证 / 巩固训练';
  if (answerStatus === 'insufficient_evidence') return '先补充作答或重新作答，再进行能力诊断。';
  if (mainAbility === '概括' && missingRubricItems.includes('core_event')) return '进入核心事件提取与主要内容概括训练。';
  if (missingRubricItems.includes('literal_to_symbolic') || missingRubricItems.includes('symbolic_meaning')) return '进入关键词深层含义转换与语境理解训练。';
  if (missingRubricItems.includes('theme_or_emotion')) return '进入核心信息筛选与主旨提炼训练。';
  if (missingRubricItems.includes('text_evidence')) return '进入文本依据提取与“依据 + 分析 + 结论”表达训练。';
  if (missingRubricItems.includes('inference_chain')) return '进入基于文本依据的推理链训练。';
  if (mainAbility === '信息提取') return '进入关键词定位与完整要点提取训练。';
  return `进入「${mainAbility}」能力的针对训练。`;
}

function buildAbilityEvidence(
  mainAbility: string,
  relatedAbilities: string[],
  overlap: number,
  rubricItems: OpenResponseRubricItem[],
  answerStatus: OpenResponseAnswerStatus,
): string[] {
  const evidence = [
    `题目主要映射到「${mainAbility}」能力，并关联「${relatedAbilities.join('、')}」能力路径。`,
    `学生答案与参考答案的关键点重合度约为 ${Math.round(overlap * 100)}%，仅作为 rubric 匹配的辅助信号。`,
  ];

  for (const item of rubricItems) {
    evidence.push(
      item.matched
        ? `已满足 rubric「${item.label}」：${item.evidence}`
        : `缺失 rubric「${item.label}」：${item.missingReason}`,
    );
  }

  if (answerStatus === 'fully_meets') {
    evidence.push('学生答案满足主要 rubric 要点，可形成正向能力证据。');
  }

  return evidence;
}

function buildDiagnosisSummary(
  mainAbility: string,
  answerStatus: OpenResponseAnswerStatus,
  scoreBand: OpenResponseScoreBand,
): string {
  return `本次 open_response 任务使用 rubric 诊断，主要观察「${mainAbility}」能力；answerStatus=${answerStatus}，scoreBand=${scoreBand}。`;
}

function inferConfidence(answerStatus: OpenResponseAnswerStatus, overlap: number): number {
  if (answerStatus === 'fully_meets') return overlap >= 0.95 ? 0.9 : 0.78;
  if (answerStatus === 'insufficient_evidence') return 0.35;
  if (answerStatus === 'does_not_meet') return 0.62;
  return 0.68;
}

function inferMatchedEvidence(id: string, ability: string): string {
  return `学生答案中出现可支持「${ability}」能力要点 ${id} 的内容。`;
}

function inferMissingReason(id: string, ability: string): string {
  return `学生答案尚未形成可支持「${ability}」能力要点 ${id} 的充分证据。`;
}

function abilityToErrorType(mainAbility: string): DiagnosisResult['errorType'] {
  const map: Record<string, DiagnosisResult['errorType']> = {
    信息提取: '定位错误',
    理解: '理解错误',
    概括: '概括错误',
    分析: '分析错误',
    推理: '推理错误',
    表达: '表达错误',
  };

  return map[mainAbility] || '待验证';
}

function keywordOverlap(referenceAnswer: string, studentAnswer: string): number {
  const referenceTokens = tokenize(referenceAnswer);
  const studentTokens = new Set(tokenize(studentAnswer));

  if (referenceTokens.length === 0 || studentTokens.size === 0) return 0;

  const matched = referenceTokens.filter((token) => studentTokens.has(token)).length;
  return matched / referenceTokens.length;
}

function isOpenResponseCorrect(referenceAnswer: string, studentAnswer: string, overlap: number): boolean {
  const normalizedReference = normalizeAnswer(referenceAnswer);
  const normalizedStudent = normalizeAnswer(studentAnswer);

  if (!normalizedReference || !normalizedStudent) return false;
  if (normalizedReference === normalizedStudent) return true;

  return overlap >= 0.95;
}

function tokenize(value: string): string[] {
  return value
    .replace(/[，。！？；：“”‘’、,.!?;:"'()\[\]{}]/g, ' ')
    .split(/\s+/)
    .flatMap((part) => part.length > 2 ? part.match(/[\u4e00-\u9fa5]{2}|[a-zA-Z0-9]+/g) || [] : [part])
    .filter(Boolean);
}

function normalizeAnswer(value: string): string {
  return value
    .replace(/\s+/g, '')
    .replace(/[，。！？；：“”‘’、,.!?;:"'()\[\]{}]/g, '')
    .trim();
}
