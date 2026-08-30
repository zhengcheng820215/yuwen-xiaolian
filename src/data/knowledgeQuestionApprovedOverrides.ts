import type { KnowledgeQuestion } from '../domain/knowledge-practice/questions/knowledgeQuestionTypes.ts';

const REVIEWED_AT = '2026-08-28T00:00:00.000Z';
const fillRules = ['trim', 'collapse_whitespace', 'normalize_fullwidth_space', 'ignore_terminal_punctuation'] as const;

export const KNOWLEDGE_QUESTION_APPROVED_OVERRIDES: Record<string, Partial<KnowledgeQuestion>> = {
  'q-zy-1': {
    contentVersion: 2,
    contentStatus: 'approved',
    stem: '下列词语中加点字读音完全正确的一项是：',
    options: [
      { id: 'opt-a', text: '酝酿（niàng）　倔强（qiáng）' },
      { id: 'opt-b', text: '贮蓄（zhù）　狭隘（ài）' },
      { id: 'opt-c', text: '粗犷（kuàng）　静谧（mì）' },
      { id: 'opt-d', text: '确凿（záo）　莅临（wèi）' },
    ],
    correctAnswer: 'opt-b',
    explanation: '辨析字音时要逐字核对声母、韵母和声调，不能只凭日常口语印象。',
    answerAnalysis: {
      'opt-a': '“倔强”的“强”应读 jiàng，不读 qiáng。',
      'opt-b': '“贮蓄”读 zhù xù，“狭隘”读 xiá ài，两处读音均正确。',
      'opt-c': '“粗犷”的“犷”应读 guǎng，不读 kuàng。',
      'opt-d': '“莅临”的“莅”应读 lì，不读 wèi。',
    },
    misconceptionByAnswer: {
      'opt-a': { code: 'pronunciation-polyphone-confused', studentMessage: '这个选项需要结合词语语境判断多音字“强”的读音。' },
      'opt-c': { code: 'pronunciation-initial-confused', studentMessage: '这个选项容易把“犷”的声母误读，需要按规范读音核对。' },
      'opt-d': { code: 'pronunciation-character-confused', studentMessage: '这个选项把“莅”的读音与字形相近或常见音混淆了。' },
    },
    solutionSteps: ['逐个圈出被考查的字', '分别核对声母、韵母和声调', '确认一项中的所有读音都正确'],
    reviewedAt: REVIEWED_AT,
  },
  'q-zy-2': {
    contentVersion: 2,
    contentStatus: 'approved',
    answerAnalysis: {
      'opt-a': '“分歧、烂漫、人声鼎沸”书写均正确。',
      'opt-b': '“奥密”应为“奥秘”，“喜出忘外”应为“喜出望外”。',
      'opt-c': '“花团锦族”应为“花团锦簇”。',
      'opt-d': '“翻来复去”应为“翻来覆去”。',
    },
    misconceptionByAnswer: {
      'opt-b': { code: 'character-shape-confused', studentMessage: '这个选项包含多个同音或形近字，需要逐词核对固定写法。' },
      'opt-c': { code: 'character-shape-confused', studentMessage: '“锦簇”的“簇”容易被形近字替代，需要结合词义记忆。' },
      'opt-d': { code: 'character-shape-confused', studentMessage: '“翻来覆去”的“覆”表示翻转，不能写成“复”。' },
    },
    solutionSteps: ['逐词检查固定写法', '用词义区分同音或形近字', '确认选项中每个词都没有错字'],
    reviewedAt: REVIEWED_AT,
  },
  'q-zy-3': {
    contentVersion: 2,
    contentStatus: 'approved',
    stem: '“着落”中的“着”应读 zhuó。',
    options: [{ id: 'true', text: '正确' }, { id: 'false', text: '错误' }],
    correctAnswer: 'true',
    answerAnalysis: {
      true: '“着落”中的“着”读 zhuó，表示事情有归宿或结果。',
      false: '把这里的“着”读成其他音，没有结合“着落”这一固定词语判断。',
    },
    misconceptionByAnswer: {
      false: { code: 'pronunciation-polyphone-confused', studentMessage: '这个选择需要把多音字放回固定词语中判断读音。' },
    },
    solutionSteps: ['先确认多音字所在的完整词语', '根据词义确定读音'],
    reviewedAt: REVIEWED_AT,
  },
  'q-cy-1': {
    contentVersion: 2,
    contentStatus: 'approved',
    explanation: '判断成语是否恰当，需要同时检查词义、使用对象和前后语境。',
    answerAnalysis: {
      'opt-a': '“不求甚解”指学习不深入，与“所以成绩稳步提高”的因果语境冲突。',
      'opt-b': '“骇人听闻”形容使人听了非常吃惊或害怕的严重事件，不适合形容观点鲜明。',
      'opt-c': '“恍然大悟”表示忽然明白，符合老师讲解后明白的语境。',
      'opt-d': '“美轮美奂”常用于形容建筑等高大华美，不适合形容语言平淡的作文。',
    },
    misconceptionByAnswer: {
      'opt-a': { code: 'idiom-context-logic-missed', studentMessage: '这个选项需要核对成语含义与句子前后逻辑是否一致。' },
      'opt-b': { code: 'idiom-context-severity-missed', studentMessage: '这个选项需要检查成语所适用的事件性质和严重程度。' },
      'opt-d': { code: 'idiom-object-mismatch', studentMessage: '这个选项需要检查成语通常修饰的对象。' },
    },
    solutionSteps: ['确认成语的准确含义', '检查成语通常修饰的对象', '核对句子前后语境'],
    reviewedAt: REVIEWED_AT,
  },
  'q-bd-1': {
    contentVersion: 2,
    contentStatus: 'approved',
    options: [{ id: 'true', text: '正确' }, { id: 'false', text: '错误' }],
    correctAnswer: 'true',
    answerAnalysis: {
      true: '书名《朝花夕拾》使用书名号，整句是疑问句，句末使用问号，标点正确。',
      false: '书名号和句末问号都符合各自作用，这句话没有标点错误。',
    },
    misconceptionByAnswer: {
      false: { code: 'punctuation-context-missed', studentMessage: '这个选择需要分别检查书名号和整句句末标点的作用。' },
    },
    solutionSteps: ['先确认作品名称使用书名号', '再判断整句话的语气', '最后核对句末标点'],
    reviewedAt: REVIEWED_AT,
  },
  'q-wx-2': {
    contentVersion: 2,
    contentStatus: 'approved',
    category: '文学文化常识',
    answerAnalysis: {
      'opt-a': '《朝花夕拾》是鲁迅的回忆性散文集。',
      'opt-b': '鲁迅的小说集包括《呐喊》《彷徨》等，《朝花夕拾》不是小说集。',
      'opt-c': '《朝花夕拾》以散文为主要体裁，不是诗歌集。',
      'opt-d': '《朝花夕拾》不是戏剧集。',
    },
    misconceptionByAnswer: {
      'opt-b': { code: 'literature-genre-confused', studentMessage: '这个选项把鲁迅的散文集与小说集混淆了。' },
      'opt-c': { code: 'literature-genre-confused', studentMessage: '这个选项需要核对作品的具体文体。' },
      'opt-d': { code: 'literature-genre-confused', studentMessage: '这个选项需要核对作品的具体文体。' },
    },
    solutionSteps: ['先确认作者和作品', '再回忆作品收录内容', '据此判断作品体裁'],
    reviewedAt: REVIEWED_AT,
  },
  'q-wx-3': {
    contentVersion: 2,
    contentStatus: 'approved',
    category: '文学文化常识',
    options: [{ id: 'true', text: '正确' }, { id: 'false', text: '错误' }],
    correctAnswer: 'true',
    answerAnalysis: {
      true: '《皇帝的新装》是丹麦作家安徒生创作的童话。',
      false: '作者国籍和作品对应均正确，不能判为错误。',
    },
    misconceptionByAnswer: {
      false: { code: 'literature-author-confused', studentMessage: '这个选择需要重新核对作品、作者和国籍三者的对应关系。' },
    },
    solutionSteps: ['确认作品名称', '回忆作者', '核对作者国籍与作品体裁'],
    reviewedAt: REVIEWED_AT,
  },
  'q-gs-1': {
    contentVersion: 2,
    contentStatus: 'approved',
    category: '古诗文默写与理解',
    acceptedAnswers: ['江春入旧年'],
    answerNormalization: [...fillRules],
    solutionSteps: ['确定篇目和相邻诗句', '逐字写出答案', '检查是否有错字、漏字或多字'],
    reviewedAt: REVIEWED_AT,
  },
  'q-gs-2': {
    contentVersion: 2,
    contentStatus: 'approved',
    category: '古诗文默写与理解',
    acceptedAnswers: ['随君直到夜郎西'],
    answerNormalization: [...fillRules],
    solutionSteps: ['根据题干确定诗句内容', '逐字写出下一句', '检查“君”“夜郎”等关键字'],
    reviewedAt: REVIEWED_AT,
  },
  'q-wy-1': {
    contentVersion: 2,
    contentStatus: 'approved',
    options: [
      { id: 'opt-a', text: '表转折' },
      { id: 'opt-b', text: '表承接' },
      { id: 'opt-c', text: '表修饰' },
      { id: 'opt-d', text: '表假设' },
    ],
    correctAnswer: 'opt-b',
    explanation: '“学而时习之”中的“而”连接“学”和“时习”，表示动作前后承接。',
    answerAnalysis: {
      'opt-a': '句中没有“但是、却”的转折关系。',
      'opt-b': '先学习，再按时温习，两个动作构成承接关系。',
      'opt-c': '“学”不是“时习”的方式或状态，不能解释为修饰。',
      'opt-d': '句中没有假设条件。',
    },
    misconceptionByAnswer: {
      'opt-a': { code: 'classical-function-word-confused', studentMessage: '这个选项需要根据分句之间的实际关系判断“而”的用法。' },
      'opt-c': { code: 'classical-function-word-confused', studentMessage: '这个选项把动作承接关系误判成了修饰关系。' },
      'opt-d': { code: 'classical-function-word-confused', studentMessage: '句中没有假设条件，需要结合上下文关系判断。' },
    },
    solutionSteps: ['分别理解“学”和“时习”', '判断两个动作的先后关系', '选择对应的虚词用法'],
    reviewedAt: REVIEWED_AT,
  },
  'q-wy-2': {
    contentVersion: 2,
    contentStatus: 'approved',
    answerAnalysis: {
      'opt-a': '这里不是说明原因，不能解释为“因为”。',
      'opt-b': '“因风起”意为乘着风飞起，“因”解释为“趁、乘”。',
      'opt-c': '句中没有表示前后事件接续的“于是”之意。',
      'opt-d': '“依靠”接近现代词义，但不能准确表达柳絮乘风而起的语境。',
    },
    misconceptionByAnswer: {
      'opt-a': { code: 'classical-word-modern-meaning-confused', studentMessage: '这个选项直接套用了现代常见义，需要结合句子翻译判断。' },
      'opt-c': { code: 'classical-context-relation-missed', studentMessage: '这个选项需要核对句中是否真的存在事件接续关系。' },
      'opt-d': { code: 'classical-word-meaning-imprecise', studentMessage: '这个选项接近字面联想，但不符合“乘风而起”的准确语义。' },
    },
    solutionSteps: ['把词语放回原句', '尝试完整翻译句子', '选择使句意最通顺准确的解释'],
    reviewedAt: REVIEWED_AT,
  },
  'q-wy-3': {
    contentVersion: 2,
    contentStatus: 'approved',
    options: [{ id: 'true', text: '正确' }, { id: 'false', text: '错误' }],
    correctAnswer: 'true',
    answerAnalysis: {
      true: '结合《论语》语境，“朋”可理解为志同道合、同门求学的人。',
      false: '如果只按现代日常词义理解“朋”，会忽略《论语》中的具体语境。',
    },
    misconceptionByAnswer: {
      false: { code: 'classical-word-modern-meaning-confused', studentMessage: '这个选择需要避免直接套用现代常用义，应结合篇目语境理解。' },
    },
    solutionSteps: ['定位词语所在篇目和句子', '结合上下文与教材注释理解', '避免直接套用现代词义'],
    reviewedAt: REVIEWED_AT,
  },
};
