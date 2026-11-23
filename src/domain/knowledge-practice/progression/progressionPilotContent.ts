import type { ProgressionContentManifest } from './progressionContentReadiness.ts';

// Reserved pilot identities only. No question has been admitted to the progression pool.
export const PROGRESSION_PILOT_CONTENT: ProgressionContentManifest[] = [
  {
    knowledgePointId: 'kp-polyphone-context-pronunciation', knowledgePointLabel: '多音字语境读音',
    category: '字音字形', mappingVersion: 'unverified-v1', ruleVersion: 'pilot-v1',
    reviewStatus: 'pending', bands: [], questions: [], reinforcementPairs: [],
  },
  {
    knowledgePointId: 'kp-classical-ancient-modern-meaning', knowledgePointLabel: '文言词语古今异义辨析',
    category: '文言实词虚词', mappingVersion: 'unverified-v1', ruleVersion: 'pilot-v1',
    reviewStatus: 'pending', bands: [], questions: [], reinforcementPairs: [],
  },
  {
    knowledgePointId: 'kp-idiom-applicable-object', knowledgePointLabel: '成语适用对象',
    category: '成语运用', mappingVersion: 'unverified-v1', ruleVersion: 'pilot-v1',
    reviewStatus: 'pending', bands: [], questions: [], reinforcementPairs: [],
  },
];
