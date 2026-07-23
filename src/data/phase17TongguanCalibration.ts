import type { MaterialProductionTaskInput } from '../ai/agents/materialObservationApplicationService.ts';
import type {
  ObservationCalibrationCase,
  ObservationResourceDraftSpecification,
} from '../ai/schemas/materialObservation.schema.ts';
import type {
  PrimaryAbilityId,
  QuestionResourceRubricItem,
} from '../ai/schemas/questionResourceAdmission.schema.ts';

export const PHASE17_TONGGUAN_MATERIAL = {
  materialId: 'phase17-calibration-tongguan',
  materialVersionId: 'phase17-calibration-tongguan:v1',
  versionNumber: 1,
  title: '谭嗣同《潼关》',
  content: [
    '终古高云簇此城，',
    '秋风吹散马蹄声。',
    '河流大野犹嫌束，',
    '山入潼关不解平。',
    '创作背景：少年谭嗣同随父亲远赴甘肃，途经陕西潼关，被北方壮阔的山河景象触动，写下这首诗。',
  ].join('\n'),
  source: {
    sourceType: 'manual' as const,
    description: 'Phase 17.2 Material Cluster 校准案例。诗歌正文属于公版文本，创作背景为人工概括。',
    copyrightNote: '不使用教材页面图片、版式和成套注释；正式发布前仍需内容负责人复核来源说明。',
  },
};

export const PHASE17_TONGGUAN_TASKS: MaterialProductionTaskInput[] = [
  {
    primaryDimension: 'fact',
    observationFocus: focus('scene-dynamics', '景物与动态信息提取', '准确识别诗句中的自然景物及其动态状态，不混入题外信息。'),
    abilityId: 'extraction',
    taskRole: 'training',
    difficulty: 'basic',
    anchorType: 'full_text',
    questionStem: '诗中写到了哪些自然景物？请至少写出三种，并分别概括它们呈现出的状态。',
    expectedStudentAction: '从诗句中提取至少三种景物，并分别写出对应的动态或状态。',
    designReason: '观察学生能否准确读取显性信息，而不是只罗列名词或补入诗外内容。',
    materialRelationIntent: 'same_context',
    resourceDraftSpecification: specification({
      abilityId: 'extraction',
      title: '《潼关》· 景物与动态信息提取',
      assessmentMode: 'key_points',
      acceptedKeywords: ['高云聚集或围绕城上方', '秋风吹散马蹄声', '河流奔向广阔原野', '群山进入潼关后仍不平缓'],
      rubric: [
        rubric('scene-count', '提取景物', 'extraction', '写出至少三种来自诗句的自然景物。', ['高云', '秋风', '河流', '大野', '群山']),
        rubric('scene-state', '对应状态', 'extraction', '为所写景物补充诗句呈现的动态或状态。', ['聚集', '吹散', '奔流', '不受拘束', '不平缓']),
      ],
      minLength: 12,
    }),
    calibrationCases: calibration('tg-q1', [
      ['fully_meets', '高云聚集在城上方，秋风吹散马蹄声，黄河奔向大野，群山进入潼关后依然起伏。', 'fully_meets', '景物和状态对应完整。'],
      ['partially_meets', '诗中写了高云、秋风、黄河和群山。', 'partially_meets', '提取对象正确，但缺少相应状态。'],
      ['typical_error', '潼关城内百姓生活热闹，街道上人来人往。', 'does_not_meet', '答案加入了诗中不存在的信息。'],
      ['reasonable_alternative', '云层围绕城上方，风中马蹄声渐远，河水向平原奔去，山势仍然高低起伏。', 'fully_meets', '未复用原词，但表达了等价事实。'],
    ]),
  },
  {
    primaryDimension: 'language',
    observationFocus: focus('verb-context', '关键动词的语境理解', '结合诗句说明关键动词的语境含义及其形成的具体景象。'),
    abilityId: 'comprehension',
    taskRole: 'training',
    difficulty: 'basic',
    anchorType: 'paragraph',
    startParagraph: 1,
    questionStem: '“终古高云簇此城”中的“簇”字，在诗句中写出了怎样的景象？',
    expectedStudentAction: '解释“簇”的语境含义，并说明高云与潼关城的空间关系和画面感。',
    designReason: '观察学生是否能把词义放回诗句，而不是只给字典解释。',
    materialRelationIntent: 'same_context',
    resourceDraftSpecification: specification({
      abilityId: 'comprehension',
      title: '《潼关》· “簇”的语境理解',
      assessmentMode: 'reasoning_chain',
      acceptedKeywords: ['聚集', '围拢', '环绕', '城上方', '高峻', '厚重', '雄浑'],
      rubric: [
        rubric('verb-meaning', '理解词义', 'comprehension', '理解“簇”在诗句中有聚集、围拢之意。', ['聚集', '围拢', '环绕']),
        rubric('scene-relation', '结合景象', 'comprehension', '说明高云与潼关城的空间关系或形成的画面感。', ['城上方', '高云环绕城', '高峻', '厚重', '有气势']),
      ],
      minLength: 10,
    }),
    calibrationCases: calibration('tg-q2', [
      ['fully_meets', '“簇”写出高高的云层聚集、环绕在潼关城上方，使潼关显得高峻而有气势。', 'fully_meets', '词义、空间关系和画面感均成立。'],
      ['partially_meets', '“簇”就是聚集的意思。', 'partially_meets', '词义正确，但没有结合诗句说明景象。'],
      ['typical_error', '“簇”写出了云被秋风吹散。', 'does_not_meet', '混淆了第一句和第二句的动作。'],
    ]),
  },
  {
    primaryDimension: 'structure',
    observationFocus: focus('overall-scene', '整体景象概括', '整合多个景物与动态信息，概括全诗形成的总体景象特征。'),
    abilityId: 'summarization',
    taskRole: 'training',
    difficulty: 'intermediate',
    anchorType: 'full_text',
    questionStem: '结合全诗，概括诗人笔下潼关景物的总体特点。',
    expectedStudentAction: '整合云、风、河流和群山等局部信息，形成简洁的整体特点概括。',
    designReason: '观察学生能否从分散信息形成总体判断，而不是继续罗列景物。',
    materialRelationIntent: 'same_context',
    resourceDraftSpecification: specification({
      abilityId: 'summarization',
      title: '《潼关》· 整体景象概括',
      assessmentMode: 'key_points',
      acceptedKeywords: ['壮阔', '雄浑', '高峻', '开阔', '奔放', '有力量', '动态感'],
      rubric: [
        rubric('integrated-scene', '整合景物', 'summarization', '综合至少两类景物及其状态，不停留在名称罗列。', ['云风河山的综合', '多个景物共同形成']),
        rubric('overall-feature', '形成总体特点', 'summarization', '概括出壮阔、高峻、奔放或富有力量等整体特征。', ['壮阔', '雄浑', '高峻', '开阔', '奔放', '有力量']),
      ],
      minLength: 12,
    }),
    calibrationCases: calibration('tg-q3', [
      ['fully_meets', '诗中的潼关高云环绕、秋风劲吹，黄河奔腾、群山起伏，呈现出壮阔高峻、充满力量的景象。', 'fully_meets', '整合了局部景物并形成总体特点。'],
      ['partially_meets', '潼关有云、有风、有河流和山。', 'partially_meets', '只罗列景物，没有完成概括。'],
      ['typical_error', '诗中描写了安静柔和的江南水乡景色。', 'does_not_meet', '整体基调与诗句不符。'],
      ['concise_valid', '潼关景象高峻壮阔，山河奔放有力。', 'fully_meets', '表达简洁，但已经完成整体概括。'],
    ]),
  },
  {
    primaryDimension: 'language',
    observationFocus: focus('personification-effect', '拟人与表达作用分析', '识别景物人格化表达，并建立具体词语、景物特点与表达作用之间的关系。'),
    abilityId: 'analysis',
    taskRole: 'training',
    difficulty: 'intermediate',
    anchorType: 'paragraph_range',
    startParagraph: 3,
    endParagraph: 4,
    questionStem: '“河流大野犹嫌束，山入潼关不解平”运用了怎样的修辞手法？请结合具体词语分析其表达作用。',
    expectedStudentAction: '识别拟人，找到“嫌束”“不解平”等依据，并说明这些词如何表现山河的力量。',
    designReason: '观察学生能否建立“具体词语—修辞—景物特点—表达作用”的分析关系。',
    materialRelationIntent: 'same_context',
    resourceDraftSpecification: specification({
      abilityId: 'analysis',
      supportingAbilityIds: ['comprehension'],
      title: '《潼关》· 拟人与表达作用分析',
      assessmentMode: 'reasoning_chain',
      acceptedKeywords: ['拟人', '人格化', '嫌束', '不解平', '不愿受拘束', '奔放', '有力量'],
      rubric: [
        rubric('device', '判断修辞', 'analysis', '准确指出拟人或人格化表达。', ['拟人', '人格化']),
        rubric('word-evidence', '找到词语依据', 'comprehension', '找到并解释“嫌束”“不解平”等具体表达。', ['嫌束', '不解平']),
        rubric('effect', '分析表达作用', 'analysis', '说明拟人如何突出山河奔放有力、不受束缚的特点。', ['奔放', '有力量', '不受束缚', '不愿趋于平缓']),
      ],
      minLength: 24,
    }),
    calibrationCases: calibration('tg-q4', [
      ['fully_meets', '后两句运用拟人。“嫌束”写黄河仿佛不满受到约束，“不解平”写群山仿佛不愿变得平缓，突出山河奔放有力的特点。', 'fully_meets', '手法、词语依据和作用关系完整。'],
      ['partially_meets', '运用了拟人的手法，写得生动形象。', 'partially_meets', '判断手法正确，但没有具体依据和作用分析。'],
      ['typical_error', '诗人运用比喻，把黄河比作人。', 'does_not_meet', '把拟人与比喻混淆。'],
      ['reasonable_alternative', '诗人把河流和山写得仿佛有自己的性格，它们都不愿受到限制，表现出山河桀骜奔放的力量。', 'fully_meets', '没有使用标准术语堆叠，但分析关系成立。'],
    ]),
  },
  {
    primaryDimension: 'theme',
    observationFocus: focus('scene-to-spirit', '景物与诗人精神的推断', '依据景物状态和创作背景，克制地推断诗人的精神气质。'),
    abilityId: 'inference',
    taskRole: 'training',
    difficulty: 'advanced',
    anchorType: 'full_text',
    questionStem: '有人认为，诗中后两句不仅写山河，也隐约写出了少年谭嗣同的精神气质。你是否赞同？请结合诗句和创作背景说明理由。',
    expectedStudentAction: '给出判断，概括山河不愿受束缚的状态，并说明它与少年诗人精神之间的合理联系。',
    designReason: '观察学生能否从文本证据形成克制推断，而不是依赖课外知识倒推历史结论。',
    materialRelationIntent: 'same_context',
    resourceDraftSpecification: specification({
      abilityId: 'inference',
      supportingAbilityIds: ['analysis', 'expression'],
      title: '《潼关》· 景物到诗人精神的推断',
      assessmentMode: 'reasoning_chain',
      acceptedKeywords: ['嫌束', '不解平', '不愿受束缚', '追求自由', '意气风发', '冲破限制', '豪迈进取'],
      rubric: [
        rubric('position', '给出判断', 'inference', '对题目观点给出明确判断。', ['赞同', '不完全赞同', '有条件赞同']),
        rubric('scene-evidence', '使用诗句依据', 'analysis', '概括后两句山河不愿受束缚的状态。', ['嫌束', '不解平', '山河不愿受到限制']),
        rubric('inference-link', '建立推断关系', 'inference', '说明景物状态与少年诗人精神追求之间的合理联系。', ['追求自由', '冲破限制', '意气风发', '豪迈进取']),
      ],
      minLength: 32,
    }),
    calibrationCases: calibration('tg-q5', [
      ['fully_meets', '我赞同。“嫌束”“不解平”把黄河和群山写得仿佛不愿受到限制。结合诗人少年时面对壮阔山河的经历，可以推断这也寄托了他追求自由、渴望冲破束缚的精神。', 'fully_meets', '判断、诗句依据和推断关系完整。'],
      ['partially_meets', '我赞同，因为谭嗣同很有志向。', 'partially_meets', '有结论，但没有使用诗句形成推断。'],
      ['typical_error', '诗中直接写明谭嗣同以后要参加变法。', 'does_not_meet', '把课外历史行动虚构成诗句直接内容。'],
      ['reasonable_alternative', '山河仿佛都有不肯屈服的性格，这与少年诗人意气风发、向往广阔天地的状态相呼应。', 'fully_meets', '推断表述不同，但没有越过文本边界。'],
    ]),
  },
  {
    primaryDimension: 'language',
    observationFocus: focus('integrated-appreciation', '诗歌赏析表达', '组织诗句内容、表达手法、具体依据和表达作用，形成连贯赏析。'),
    abilityId: 'expression',
    taskRole: 'training',
    difficulty: 'advanced',
    anchorType: 'paragraph_range',
    startParagraph: 3,
    endParagraph: 4,
    questionStem: '请用80字左右赏析《潼关》后两句。要求包含：写了什么、怎样写、表现了什么。',
    expectedStudentAction: '围绕内容、写法、具体依据和作用组织一段连贯、完整的赏析。',
    designReason: '观察学生能否把已有理解和分析组织成清楚表达；本题不冒充 Q4 的同能力复测。',
    materialRelationIntent: 'same_context',
    resourceDraftSpecification: specification({
      abilityId: 'expression',
      supportingAbilityIds: ['analysis', 'summarization'],
      title: '《潼关》· 综合赏析表达',
      assessmentMode: 'expression_quality',
      acceptedKeywords: ['后两句内容', '拟人或人格化', '嫌束', '不解平', '景物特点', '诗人精神'],
      rubric: [
        rubric('content', '说明写了什么', 'summarization', '概括后两句描写的河流和群山状态。', ['河流奔向大野', '群山进入潼关', '山河状态']),
        rubric('method', '说明怎样写', 'analysis', '指出拟人并使用具体词语作为依据。', ['拟人', '嫌束', '不解平']),
        rubric('meaning', '说明表现了什么', 'expression', '清楚表达景物特点或诗人精神，并使句间关系连贯。', ['奔放有力', '不甘受限', '追求自由', '表达连贯']),
      ],
      minLength: 48,
    }),
    calibrationCases: calibration('tg-q6', [
      ['fully_meets', '后两句写黄河奔向原野、群山进入潼关后的雄壮景象。诗人用“嫌束”“不解平”赋予山河人的感受，突出它们不甘受限、奔放有力的特点，也寄托了少年诗人追求自由的精神。', 'fully_meets', '内容、写法、依据和作用组织完整。'],
      ['partially_meets', '后两句运用拟人，写出了潼关的壮美，表达了诗人的感情。', 'partially_meets', '结构初步存在，但缺少具体词语和明确作用。'],
      ['typical_error', '诗人使用优美的语言，表达了对潼关的喜爱。', 'does_not_meet', '表达过于泛化，没有完成题目要求的分析层次。'],
    ]),
  },
];

export const PHASE17_TONGGUAN_EXPECTED = {
  materialCount: 1,
  taskCount: 6,
  abilities: ['extraction', 'comprehension', 'summarization', 'analysis', 'inference', 'expression'] as PrimaryAbilityId[],
  taskRole: 'training' as const,
};

function focus(focusCode: string, displayName: string, definition: string) {
  return { focusCode, displayName, definition, scope: 'plan_local' as const };
}

function rubric(
  itemId: string,
  name: string,
  abilityId: PrimaryAbilityId,
  description: string,
  acceptedSignals: string[],
): QuestionResourceRubricItem {
  return {
    itemId,
    name,
    description,
    abilityId,
    importance: 'critical',
    required: true,
    evidenceRequirement: {
      requireTextEvidence: true,
      requireExplanation: abilityId !== 'extraction',
      requireConclusion: abilityId !== 'extraction',
    },
    acceptedSignals,
  };
}

function specification(input: {
  abilityId: PrimaryAbilityId;
  supportingAbilityIds?: PrimaryAbilityId[];
  title: string;
  assessmentMode: ObservationResourceDraftSpecification['assessmentMode'];
  acceptedKeywords: string[];
  rubric: QuestionResourceRubricItem[];
  minLength: number;
}): ObservationResourceDraftSpecification {
  return {
    title: input.title,
    questionType: 'reading_comprehension',
    responseFormat: 'long_text',
    assessmentMode: input.assessmentMode,
    answerAcceptance: {
      acceptedKeywords: input.acceptedKeywords,
      semanticEquivalentAllowed: true,
      normalizationRules: ['trim', 'ignore_punctuation', 'ignore_whitespace'],
    },
    rubric: input.rubric,
    minimumAnswerRequirement: {
      minLength: input.minLength,
      requireTextEvidence: true,
      requireExplanation: input.abilityId !== 'extraction',
    },
    supportingAbilityIds: input.supportingAbilityIds || [],
    prerequisiteAbilityIds: [],
    gradeRange: '七至九年级',
    tags: ['phase17.2-calibration', 'tongguan', input.abilityId],
  };
}

function calibration(
  prefix: string,
  definitions: Array<[
    ObservationCalibrationCase['category'],
    string,
    ObservationCalibrationCase['expectedAnswerStatus'],
    string,
  ]>,
): ObservationCalibrationCase[] {
  return definitions.map(([category, answerText, expectedAnswerStatus, reviewNote], index) => ({
    calibrationCaseId: `${prefix}-${index + 1}-${category}`,
    category,
    answerText,
    expectedAnswerStatus,
    reviewNote,
  }));
}
