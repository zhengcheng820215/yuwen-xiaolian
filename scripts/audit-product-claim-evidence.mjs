import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productDir = path.join(repoRoot, 'docs', 'product')
const manifestPath = path.join(productDir, 'product-document-authority-manifest.json')
const registryPath = path.join(productDir, 'product-claim-evidence-registry.json')

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'))
const entryByPath = new Map((manifest.entries ?? []).map((entry) => [entry.path, entry]))
const failures = []
const fail = (message) => failures.push(message)

const allowedAuthorityTypes = new Set(['CURRENT_CONTROL', 'NORMATIVE_CONTRACT'])
const evidenceOnlyTypes = new Set(['IMPLEMENTATION_PLAN', 'ACCEPTANCE_REPORT', 'HISTORICAL_SNAPSHOT'])
const claims = registry.claims ?? []
const claimIds = claims.map((claim) => claim.claimId)

if (registry.currentStateSource !== manifest.currentStateSource) {
  fail(`claim registry currentStateSource must be ${manifest.currentStateSource}`)
}
if (registry.zeroUpwardInference !== true) fail('zeroUpwardInference must be true')
if (new Set(claimIds).size !== claimIds.length) fail('claim registry contains duplicate claim ids')

const resolveEvidence = (evidencePath) => path.resolve(productDir, evidencePath)

for (const claim of claims) {
  const prefix = claim.claimId || '<missing-claim-id>'
  if (!claim.claimId) fail('claim is missing claimId')
  if (!claim.title) fail(`${prefix}: title is required`)

  const authorityEntry = entryByPath.get(claim.authority)
  if (!authorityEntry) {
    fail(`${prefix}: authority is missing from document manifest: ${claim.authority}`)
  } else {
    if (authorityEntry.lifecycle !== 'ACTIVE') fail(`${prefix}: authority must be ACTIVE: ${claim.authority}`)
    if (!allowedAuthorityTypes.has(authorityEntry.documentType)) {
      fail(`${prefix}: authority must be CURRENT_CONTROL or NORMATIVE_CONTRACT: ${claim.authority}`)
    }
    if (evidenceOnlyTypes.has(authorityEntry.documentType)) {
      fail(`${prefix}: evidence document cannot be used as authority: ${claim.authority}`)
    }
  }

  const authorityPath = path.join(productDir, claim.authority ?? '')
  if (!fs.existsSync(authorityPath)) {
    fail(`${prefix}: authority file does not exist: ${claim.authority}`)
  } else {
    const body = fs.readFileSync(authorityPath, 'utf8')
    for (const token of claim.requiredTokens ?? []) {
      if (!body.includes(token)) fail(`${prefix}: authority is missing required token: ${token}`)
    }
  }

  const engineeringStatus = claim.engineering?.status
  if (!registry.enums.engineeringStatus.includes(engineeringStatus)) {
    fail(`${prefix}: invalid engineering status ${engineeringStatus}`)
  }
  const engineeringEvidence = claim.engineering?.evidence ?? []
  if (engineeringStatus === 'PASS' && engineeringEvidence.length === 0) {
    fail(`${prefix}: engineering PASS requires evidence`)
  }
  for (const evidencePath of engineeringEvidence) {
    if (!fs.existsSync(resolveEvidence(evidencePath))) fail(`${prefix}: engineering evidence does not exist: ${evidencePath}`)
  }

  const acceptanceStatus = claim.productAcceptance?.status
  if (!registry.enums.productAcceptanceStatus.includes(acceptanceStatus)) {
    fail(`${prefix}: invalid product acceptance status ${acceptanceStatus}`)
  }
  const acceptanceEvidence = claim.productAcceptance?.evidence ?? []
  if (acceptanceStatus === 'PASS') {
    if (!claim.productAcceptance?.scope?.trim()) fail(`${prefix}: product acceptance PASS requires scope`)
    if (acceptanceEvidence.length === 0) fail(`${prefix}: product acceptance PASS requires evidence`)
  }
  const acceptanceBodies = []
  for (const evidencePath of acceptanceEvidence) {
    const absolutePath = resolveEvidence(evidencePath)
    if (!fs.existsSync(absolutePath)) {
      fail(`${prefix}: product acceptance evidence does not exist: ${evidencePath}`)
    } else {
      acceptanceBodies.push(fs.readFileSync(absolutePath, 'utf8'))
    }
  }
  if (acceptanceStatus === 'PASS') {
    const combinedBody = acceptanceBodies.join('\n')
    for (const token of claim.productAcceptance?.requiredTokens ?? []) {
      if (!combinedBody.includes(token)) fail(`${prefix}: product acceptance evidence is missing required token: ${token}`)
    }
  }

  const liveStatus = claim.live?.status
  if (!registry.enums.liveStatus.includes(liveStatus)) fail(`${prefix}: invalid live status ${liveStatus}`)
  if (liveStatus === 'DEFER_TO_CURRENT_STATE' && claim.live?.source !== registry.currentStateSource) {
    fail(`${prefix}: deferred live claim must use ${registry.currentStateSource}`)
  }
  if (claim.live?.runtimeProofRequired === true && (claim.live?.proofTypes ?? []).length === 0) {
    fail(`${prefix}: runtime proof is required but proofTypes is empty`)
  }
  if (liveStatus !== 'DEFER_TO_CURRENT_STATE' && claim.live?.runtimeProofRequired === true) {
    fail(`${prefix}: runtime-dependent claim must defer to current state`)
  }

  const educationalStatus = claim.educationalEffect?.status
  if (!registry.enums.educationalEffectStatus.includes(educationalStatus)) {
    fail(`${prefix}: invalid educational effect status ${educationalStatus}`)
  }
  const educationalEvidence = claim.educationalEffect?.evidence ?? []
  if (educationalStatus === 'PASS_REAL_DATA' && educationalEvidence.length === 0) {
    fail(`${prefix}: educational effect PASS_REAL_DATA requires real-data evidence`)
  }
  for (const evidencePath of educationalEvidence) {
    if (!fs.existsSync(resolveEvidence(evidencePath))) fail(`${prefix}: educational evidence does not exist: ${evidencePath}`)
  }
}

const countBy = (selector) => Object.fromEntries(
  [...new Set(claims.map(selector))].sort().map((status) => [status, claims.filter((claim) => selector(claim) === status).length]),
)

if (failures.length > 0) {
  console.error(`Product claim evidence audit: FAIL (${failures.length})`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Product claim evidence audit: PASS')
console.log(`Claims: ${claims.length}`)
console.log(`Engineering: ${JSON.stringify(countBy((claim) => claim.engineering.status))}`)
console.log(`Product acceptance: ${JSON.stringify(countBy((claim) => claim.productAcceptance.status))}`)
console.log(`Live: ${JSON.stringify(countBy((claim) => claim.live.status))}`)
console.log(`Educational effect: ${JSON.stringify(countBy((claim) => claim.educationalEffect.status))}`)
console.log('Upward inference: BLOCKED')
console.log('Product data writes: 0')

