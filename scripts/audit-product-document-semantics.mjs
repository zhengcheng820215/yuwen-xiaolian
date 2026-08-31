import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productDir = path.join(repoRoot, 'docs', 'product')
const governanceManifestPath = path.join(productDir, 'product-document-authority-manifest.json')
const semanticRegistryPath = path.join(productDir, 'product-semantic-authority.json')

const manifest = JSON.parse(fs.readFileSync(governanceManifestPath, 'utf8'))
const registry = JSON.parse(fs.readFileSync(semanticRegistryPath, 'utf8'))
const entries = manifest.entries ?? []
const entryByPath = new Map(entries.map((entry) => [entry.path, entry]))
const failures = []
const fail = (message) => failures.push(message)

if (registry.currentStateSource !== manifest.currentStateSource) {
  fail(`semantic currentStateSource must be ${manifest.currentStateSource}`)
}

const concepts = registry.concepts ?? []
const conceptIds = concepts.map((concept) => concept.id)
if (new Set(conceptIds).size !== conceptIds.length) fail('semantic registry contains duplicate concept ids')

for (const concept of concepts) {
  const authorityEntry = entryByPath.get(concept.authority)
  if (!authorityEntry) {
    fail(`${concept.id}: authority is missing from document manifest: ${concept.authority}`)
    continue
  }
  if (authorityEntry.lifecycle !== 'ACTIVE') {
    fail(`${concept.id}: authority must be ACTIVE: ${concept.authority}`)
  }
  if (!['CURRENT_CONTROL', 'NORMATIVE_CONTRACT'].includes(authorityEntry.documentType)) {
    fail(`${concept.id}: authority must be current control or normative contract: ${concept.authority}`)
  }

  const authorityPath = path.join(productDir, concept.authority)
  if (!fs.existsSync(authorityPath)) {
    fail(`${concept.id}: authority file does not exist: ${concept.authority}`)
    continue
  }
  const body = fs.readFileSync(authorityPath, 'utf8')
  for (const token of concept.requiredTokens ?? []) {
    if (!body.includes(token)) fail(`${concept.id}: authority is missing required token: ${token}`)
  }

  for (const supportingDocument of concept.supportingDocuments ?? []) {
    const supportingEntry = entryByPath.get(supportingDocument)
    if (!supportingEntry) {
      fail(`${concept.id}: supporting document is missing from manifest: ${supportingDocument}`)
      continue
    }
    if (!fs.existsSync(path.join(productDir, supportingDocument))) {
      fail(`${concept.id}: supporting document does not exist: ${supportingDocument}`)
    }
  }
}

const mainChainPath = path.join(productDir, 'PRODUCT_DOMAIN_SEMANTICS_AND_MAIN_CHAIN_CONTRACT.md')
const mainChainBody = fs.readFileSync(mainChainPath, 'utf8')
const requiredMainChainObjects = [
  'MaterialVersion',
  'ObservationPlan',
  'TrainingTask',
  'QuestionCandidate',
  'AdoptionCommand',
  'QuestionRevision',
  'QualityAssessment',
  'ResourceReviewDecision',
  'FrozenResourceVersion',
  'ActiveRegistryLink',
  'LearningConsumable',
  'LearningSessionTaskQueue',
  'Attempt',
  'Diagnosis',
  'AbilityEvidence',
  'RevisedResponse',
  'Retest',
  'Transfer',
]
for (const objectName of requiredMainChainObjects) {
  if (!mainChainBody.includes(objectName)) fail(`main-chain contract is missing object: ${objectName}`)
}

const forbiddenActivePhrases = [
  'Engineering Pending',
  '工程状态：IN PROGRESS',
  '当前正式题严格保持',
  '当前46道正式题',
  '当前34道正式题',
  '当前正式题仍为',
  '当前记录仍为',
  '当前专项结果',
  '当前真实正式资源只读验收',
]
const activeAuthorityEntries = entries.filter(
  (entry) => entry.lifecycle === 'ACTIVE' && ['CURRENT_CONTROL', 'NORMATIVE_CONTRACT'].includes(entry.documentType),
)
for (const entry of activeAuthorityEntries) {
  const body = fs.readFileSync(path.join(productDir, entry.path), 'utf8')
  for (const phrase of forbiddenActivePhrases) {
    if (body.includes(phrase)) fail(`${entry.path}: stale current-state phrase must be historicalized: ${phrase}`)
  }
}

const semanticsEntry = entryByPath.get('PRODUCT_DOMAIN_SEMANTICS_AND_MAIN_CHAIN_CONTRACT.md')
if (!semanticsEntry || semanticsEntry.authority !== 'NORMATIVE' || semanticsEntry.lifecycle !== 'ACTIVE') {
  fail('domain semantics contract must be an ACTIVE NORMATIVE authority')
}

if (failures.length > 0) {
  console.error(`Product document semantic audit: FAIL (${failures.length})`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Product document semantic audit: PASS')
console.log(`Semantic concepts: ${concepts.length}`)
console.log(`Active authority documents scanned: ${activeAuthorityEntries.length}`)
console.log(`Main-chain objects: ${requiredMainChainObjects.length}`)
console.log('Current-state count phrases: HISTORICALIZED')
console.log('Product data writes: 0')
