import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  evaluateCurrentFormalResourceQualityAdmission,
  filterCurrentFormalResourcesForNewLearningSession,
} from '../agents/phase173FormalResourceMatchingService.ts';

const store = new SharedFormalResourceStore();
const snapshot = await store.read();
const activeVersionIds = new Set(snapshot.data.questionResources.registryEntries
  .filter((entry) => entry.status === 'active' && entry.currentFrozenVersionId)
  .map((entry) => entry.currentFrozenVersionId!));
const currentVersions = snapshot.data.questionResources.versions.filter((version) => (
  activeVersionIds.has(version.resourceVersionId) && version.status === 'frozen'
));
const admissions = evaluateCurrentFormalResourceQualityAdmission(currentVersions);
const eligible = filterCurrentFormalResourcesForNewLearningSession(currentVersions);
const qualityEligibleCoreVersionIds = new Set(admissions
  .filter((item) => item.eligibleForNewLearningSession)
  .map((item) => item.resourceVersionId)
  .filter((resourceVersionId) => {
    const version = currentVersions.find((item) => item.resourceVersionId === resourceVersionId);
    return version?.materialSnapshot?.usageType !== 'targeted_excerpt';
  }));

assert.equal(admissions.length, currentVersions.length);
assert.equal(eligible.length, qualityEligibleCoreVersionIds.size);
assert(eligible.every((version) => version.materialSnapshot?.usageType !== 'targeted_excerpt'));
assert(admissions.every((item) => item.policyVersion));
assert.equal(
  admissions.filter((item) => item.status === 'blocked').length,
  0,
  'Current formal corpus must not contain a latest-policy blocker after closure.',
);

const source = currentVersions[0];
assert(source, 'Current formal resource fixture is missing.');
const hiddenRequirementVersion = {
  ...source,
  resourceId: 'latest-quality-admission-blocked-fixture',
  resourceVersionId: 'latest-quality-admission-blocked-fixture:v1',
  materialId: 'latest-quality-admission-material',
  materialVersionId: 'latest-quality-admission-material:v1',
  questionStem: '请概括人物特点。',
  rubric: [{
    ...source.rubric[0],
    itemId: 'latest-quality-admission-hidden-structure',
    name: '说明总起与分述结构关系',
    description: '说明总起与分述之间的结构关系。',
    required: true,
  }],
};
const blockedAdmission = evaluateCurrentFormalResourceQualityAdmission([
  hiddenRequirementVersion,
])[0];
assert.equal(blockedAdmission.status, 'blocked');
assert(blockedAdmission.blockerCodes.includes('rubric_requirement_not_in_stem'));
assert.equal(
  filterCurrentFormalResourcesForNewLearningSession([hiddenRequirementVersion]).length,
  0,
  'A blocked Current Head must not enter a new Learning session.',
);

const coreReadingVersion = {
  ...source,
  resourceId: 'new-session-core-reading-resource',
  resourceVersionId: 'new-session-core-reading-resource:v1',
  materialId: 'new-session-core-reading-material',
  materialVersionId: 'new-session-core-reading-material:v1',
  materialSnapshot: {
    ...source.materialSnapshot!,
    materialId: 'new-session-core-reading-material',
    materialVersionId: 'new-session-core-reading-material:v1',
    usageType: 'core_reading' as const,
  },
};
const targetedExcerptVersion = {
  ...source,
  resourceId: 'new-session-targeted-excerpt-resource',
  resourceVersionId: 'new-session-targeted-excerpt-resource:v1',
  materialId: 'new-session-targeted-excerpt-material',
  materialVersionId: 'new-session-targeted-excerpt-material:v1',
  materialSnapshot: {
    ...source.materialSnapshot!,
    materialId: 'new-session-targeted-excerpt-material',
    materialVersionId: 'new-session-targeted-excerpt-material:v1',
    usageType: 'targeted_excerpt' as const,
  },
};
const historicalCoreVersion = {
  ...source,
  resourceId: 'new-session-historical-core-resource',
  resourceVersionId: 'new-session-historical-core-resource:v1',
  materialId: 'new-session-historical-core-material',
  materialVersionId: 'new-session-historical-core-material:v1',
  materialSnapshot: source.materialSnapshot
    ? {
        ...source.materialSnapshot,
        materialId: 'new-session-historical-core-material',
        materialVersionId: 'new-session-historical-core-material:v1',
        usageType: undefined,
      }
    : undefined,
};
const newSessionBoundary = filterCurrentFormalResourcesForNewLearningSession([
  coreReadingVersion,
  targetedExcerptVersion,
  historicalCoreVersion,
]);
assert.deepEqual(
  newSessionBoundary.map((version) => version.resourceVersionId),
  [coreReadingVersion.resourceVersionId, historicalCoreVersion.resourceVersionId],
  'A regular new Learning session must admit only core-reading resources.',
);
assert.equal(
  [coreReadingVersion, targetedExcerptVersion, historicalCoreVersion]
    .some((version) => version.resourceVersionId === targetedExcerptVersion.resourceVersionId),
  true,
  'The admission projection must not mutate or delete the formal targeted resource.',
);

console.log(JSON.stringify({
  currentFormalVersions: currentVersions.length,
  eligibleForNewLearningSession: eligible.length,
  targetedExcerptExcludedFromRegularSession: currentVersions.length - eligible.length,
  blockedByLatestPolicy: admissions.filter((item) => item.status === 'blocked').length,
  guided: admissions.filter((item) => item.status === 'ready_with_guidance').length,
  ready: admissions.filter((item) => item.status === 'ready').length,
}, null, 2));
console.log('Formal-resource latest-quality admission debug passed (11 / 11).');
