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

assert.equal(admissions.length, currentVersions.length);
assert.equal(eligible.length, admissions.filter((item) => item.eligibleForNewLearningSession).length);
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

console.log(JSON.stringify({
  currentFormalVersions: currentVersions.length,
  eligibleForNewLearningSession: eligible.length,
  blockedByLatestPolicy: admissions.filter((item) => item.status === 'blocked').length,
  guided: admissions.filter((item) => item.status === 'ready_with_guidance').length,
  ready: admissions.filter((item) => item.status === 'ready').length,
}, null, 2));
console.log('Formal-resource latest-quality admission debug passed (8 / 8).');
