import type {
  KnowledgeQuestion,
  KnowledgeQuestionCategory,
  KnowledgeQuestionDifficulty,
  KnowledgeQuestionOption,
  KnowledgeQuestionType,
  LegacyKnowledgeQuestion,
} from './knowledgeQuestionTypes.ts';

const TYPE_MAP: Record<string, KnowledgeQuestionType> = {
  单选题: 'single_choice',
  判断题: 'true_false',
  填空题: 'fill_blank',
};

const DIFFICULTY_MAP: Record<string, KnowledgeQuestionDifficulty> = {
  基础: 1,
  中等: 2,
  较难: 3,
};

const CATEGORY_MAP: Record<string, KnowledgeQuestionCategory> = {
  字音字形: '字音字形',
  成语运用: '成语运用',
  病句修改: '病句辨析与修改',
  标点符号: '标点符号',
  文学常识: '文学文化常识',
  古诗文默写: '古诗文默写与理解',
  文言实词虚词: '文言实词虚词',
  古文作者背景: '作家作品与课文背景',
};

const OPTION_PREFIX_PATTERN = /^\s*([A-E])\s*[.．、]\s*(.+)$/u;

export type LegacyMigrationFailure = {
  id: string;
  code: string;
  message: string;
};

export type LegacyMigrationResult = {
  questions: KnowledgeQuestion[];
  failures: LegacyMigrationFailure[];
  sourceCount: number;
  grade7Semester1CandidateCount: number;
  outOfScopeCount: number;
};

export function parseLegacyOptions(options: string[] | undefined): KnowledgeQuestionOption[] | undefined {
  if (!options) return undefined;
  return options.map((option) => {
    const match = option.match(OPTION_PREFIX_PATTERN);
    if (!match) throw new Error(`无法解析旧选项：${option}`);
    return { id: `opt-${match[1].toLowerCase()}`, text: match[2].trim() };
  });
}

export function migrateLegacyKnowledgeQuestion(source: LegacyKnowledgeQuestion): KnowledgeQuestion {
  const type = TYPE_MAP[source.type];
  const difficulty = DIFFICULTY_MAP[source.difficulty || ''];
  const category = CATEGORY_MAP[source.category];
  if (!type) throw new Error(`未知题型：${source.type}`);
  if (!difficulty) throw new Error(`未知难度：${source.difficulty || ''}`);
  if (!category) throw new Error(`未知分类：${source.category}`);

  const parsedOptions = type === 'fill_blank' ? undefined : parseLegacyOptions(source.options);
  const options = type === 'true_false'
    ? [
        { id: 'true', text: parsedOptions?.[0]?.text || '正确' },
        { id: 'false', text: parsedOptions?.[1]?.text || '错误' },
      ]
    : parsedOptions;
  let correctAnswer = source.answer.trim();
  if (type === 'true_false') {
    correctAnswer = source.answer.trim().toUpperCase() === 'A' ? 'true' : 'false';
  } else if (type !== 'fill_blank') {
    correctAnswer = `opt-${correctAnswer.toLowerCase()}`;
  }
  if (type !== 'fill_blank' && !options?.some((option) => option.id === correctAnswer)) {
    throw new Error(`答案 ${source.answer} 不对应有效选项`);
  }

  return {
    id: source.id,
    contentVersion: 1,
    contentStatus: 'draft',
    grade: source.grade?.trim() || '',
    semester: source.term?.trim() || '',
    category,
    subCategory: source.subCategory?.trim() || '',
    knowledgePoint: source.knowledgePoint?.trim() || '',
    examPoint: source.examPoint?.trim() || '',
    difficulty,
    type,
    stem: source.question.trim(),
    options,
    correctAnswer,
    acceptedAnswers: type === 'fill_blank' ? [correctAnswer] : undefined,
    answerNormalization: type === 'fill_blank'
      ? ['trim', 'collapse_whitespace', 'normalize_fullwidth_space', 'ignore_terminal_punctuation']
      : undefined,
    explanation: source.explanation?.trim() || '',
    solutionSteps: [],
    sourceText: source.sourceText?.trim() || '',
  };
}

export function migrateLegacyKnowledgeQuestions(
  sources: LegacyKnowledgeQuestion[],
): LegacyMigrationResult {
  const questions: KnowledgeQuestion[] = [];
  const failures: LegacyMigrationFailure[] = [];

  for (const source of sources) {
    try {
      questions.push(migrateLegacyKnowledgeQuestion(source));
    } catch (error) {
      failures.push({
        id: source.id || 'unknown',
        code: 'legacy.migration_failed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    questions,
    failures,
    sourceCount: sources.length,
    grade7Semester1CandidateCount: sources.filter(
      (question) => question.grade === '七年级' && question.term === '上',
    ).length,
    outOfScopeCount: sources.filter(
      (question) => question.grade !== '七年级' || question.term !== '上',
    ).length,
  };
}
