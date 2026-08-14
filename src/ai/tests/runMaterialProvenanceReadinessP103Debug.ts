import assert from 'node:assert/strict';
import { SharedFormalResourceStore } from '../../server/sharedFormalResourceStore.ts';
import {
  assessMaterialProvenanceReadiness,
} from '../agents/materialProvenanceReadinessAgent.ts';
import { createQuestionMaterial } from '../agents/questionResourceAdmissionAgent.ts';
import { InMemoryQuestionResourceAdmissionRepository } from
  '../repositories/inMemoryQuestionResourceAdmissionRepository.ts';

const store = new SharedFormalResourceStore();
const before = await store.read();
if (!before.initialized) throw new Error('Shared formal resource store is not initialized.');

const report = assessMaterialProvenanceReadiness(before.data.questionResources.materials);
assert.equal(report.materialCount, 12);
assert.equal(report.catalogEvidenceRecordedCount, 12);
assert.equal(report.internalPilotEligibleCount, 12);
assert.equal(report.exactTextVerifiedCount, 0);
assert.equal(report.rightsResolvedCount, 0);
assert.equal(report.scaleReleaseEligibleCount, 0);
assert(report.items.every((item) => item.todoCodes.includes('edition_missing')));
assert(report.items.every((item) => item.todoCodes.includes('text_verification_pending')));
assert(report.items.every((item) => item.todoCodes.includes('rights_evidence_pending')));

const fixture = structuredClone(before.data.questionResources.materials.find((item) => (
  item.status !== 'retired'
)));
assert(fixture, 'An active material is required for the P1-03 policy fixture.');
fixture.metadata = {
  ...fixture.metadata!,
  edition: 'fixture-edition',
  provenanceStatus: 'verified',
  provenanceReview: {
    ...fixture.metadata!.provenanceReview!,
    textVerificationStatus: 'verified',
    rightsStatus: 'cleared',
    textSourceLocator: 'https://example.test/authoritative-text',
    rightsEvidenceLocator: 'https://example.test/rights-evidence',
    verifiedBy: 'fixture-reviewer',
    verifiedAt: '2026-08-14T00:00:00.000Z',
  },
};
const verifiedFixture = assessMaterialProvenanceReadiness([fixture]);
assert.equal(verifiedFixture.exactTextVerifiedCount, 1);
assert.equal(verifiedFixture.rightsResolvedCount, 1);
assert.equal(verifiedFixture.scaleReleaseEligibleCount, 1);
assert.deepEqual(verifiedFixture.items[0].todoCodes, []);

fixture.metadata.provenanceReview!.rightsStatus = 'restricted';
const restrictedFixture = assessMaterialProvenanceReadiness([fixture]);
assert.equal(restrictedFixture.internalPilotEligibleCount, 0);
assert.equal(restrictedFixture.scaleReleaseEligibleCount, 0);
assert(restrictedFixture.items[0].todoCodes.includes('rights_restricted'));

const repository = new InMemoryQuestionResourceAdmissionRepository();
const normalizedMaterial = await createQuestionMaterial(repository, {
  ...fixture,
  materialId: 'p1-03-normalization-fixture',
  materialVersionId: 'p1-03-normalization-fixture:v1',
  versionNumber: 1,
  status: 'active',
  parentMaterialVersionId: undefined,
  revisionNote: 'P1-03 provenance normalization fixture',
  metadata: {
    ...fixture.metadata,
    provenanceReview: {
      ...fixture.metadata.provenanceReview!,
      rightsStatus: 'cleared',
      sourceLocator: ' https://example.test/catalog ',
      textSourceLocator: ' https://example.test/text ',
      rightsEvidenceLocator: ' https://example.test/rights ',
    },
  },
});
assert.equal(normalizedMaterial.metadata?.provenanceReview?.sourceLocator,
  'https://example.test/catalog');
assert.equal(normalizedMaterial.metadata?.provenanceReview?.textSourceLocator,
  'https://example.test/text');
assert.equal(normalizedMaterial.metadata?.provenanceReview?.rightsEvidenceLocator,
  'https://example.test/rights');

const after = await store.read();
assert.equal(after.revision, before.revision);
assert.deepEqual(after.data, before.data, 'P1-03 readiness audit must remain read-only.');

console.log(JSON.stringify({
  storeRevision: before.revision,
  ...report,
}, null, 2));
console.log('P1-03 material provenance readiness debug passed (read-only).');
