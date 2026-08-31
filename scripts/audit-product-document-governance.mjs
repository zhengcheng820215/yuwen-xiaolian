import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const productDir = path.join(repoRoot, 'docs', 'product')
const manifestPath = path.join(productDir, 'product-document-authority-manifest.json')

const failures = []
const fail = (message) => failures.push(message)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
const markdownFiles = fs.readdirSync(productDir).filter((file) => file.endsWith('.md')).sort()
const entries = manifest.entries ?? []
const entryPaths = entries.map((entry) => entry.path)

if (new Set(entryPaths).size !== entryPaths.length) fail('manifest contains duplicate document paths')

for (const file of markdownFiles) {
  const count = entryPaths.filter((entryPath) => entryPath === file).length
  if (count !== 1) fail(`${file}: expected exactly one manifest entry, found ${count}`)
}

for (const entryPath of entryPaths) {
  if (!markdownFiles.includes(entryPath)) fail(`${entryPath}: manifest entry has no Markdown document`)
}

const enumChecks = [
  ['documentType', manifest.enums.documentType],
  ['authority', manifest.enums.authority],
  ['lifecycle', manifest.enums.lifecycle],
]

for (const entry of entries) {
  for (const [field, allowed] of enumChecks) {
    if (!allowed.includes(entry[field])) fail(`${entry.path}: invalid ${field}=${entry[field]}`)
  }

  const axisChecks = [
    ['design', manifest.enums.designStatus],
    ['engineering', manifest.enums.engineeringStatus],
    ['productAcceptance', manifest.enums.productAcceptanceStatus],
    ['live', manifest.enums.liveStatus],
  ]
  for (const [field, allowed] of axisChecks) {
    if (!allowed.includes(entry.statusAxes?.[field])) {
      fail(`${entry.path}: invalid statusAxes.${field}=${entry.statusAxes?.[field]}`)
    }
  }

  if (entry.currentStateSource !== manifest.currentStateSource) {
    fail(`${entry.path}: currentStateSource must be ${manifest.currentStateSource}`)
  }

  for (const relation of [...(entry.supersedes ?? []), ...(entry.supersededBy ?? [])]) {
    if (!entryPaths.includes(relation)) fail(`${entry.path}: relation target does not exist: ${relation}`)
  }

  if (entry.documentType === 'CURRENT_CONTROL') {
    const expectedAuthority = entry.path === manifest.currentStateSource ? 'CURRENT_STATE' : 'CONTROL_PLANE'
    if (entry.authority !== expectedAuthority) fail(`${entry.path}: invalid current-control authority`)
    if (entry.path !== manifest.currentStateSource) {
      const body = fs.readFileSync(path.join(productDir, entry.path), 'utf8')
      if (!body.includes(manifest.currentStateSource)) {
        fail(`${entry.path}: current control does not link to ${manifest.currentStateSource}`)
      }
    }
  }

  if (entry.documentType !== 'CURRENT_CONTROL' && entry.statusAxes.live === 'ACTIVE') {
    fail(`${entry.path}: non-current document cannot independently claim current LIVE ACTIVE`)
  }
}

const currentEntry = entries.find((entry) => entry.path === manifest.currentStateSource)
if (!currentEntry || currentEntry.documentType !== 'CURRENT_CONTROL' || currentEntry.authority !== 'CURRENT_STATE') {
  fail('manifest currentStateSource is missing or not the unique CURRENT_STATE document')
}

const currentStateCount = entries.filter((entry) => entry.authority === 'CURRENT_STATE').length
if (currentStateCount !== 1) fail(`expected one CURRENT_STATE document, found ${currentStateCount}`)

const markdownLinkPattern = /\[[^\]]*\]\(([^)]+)\)/g
for (const file of markdownFiles) {
  const absoluteFile = path.join(productDir, file)
  const body = fs.readFileSync(absoluteFile, 'utf8')
  for (const match of body.matchAll(markdownLinkPattern)) {
    let target = match[1].trim()
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1)
    if (!target || /^(?:https?:|mailto:|#)/i.test(target)) continue
    target = target.split('#')[0].split('?')[0]
    if (!target) continue
    try {
      target = decodeURIComponent(target)
    } catch {
      fail(`${file}: malformed encoded link ${match[1]}`)
      continue
    }
    const resolved = path.resolve(path.dirname(absoluteFile), target)
    if (!fs.existsSync(resolved)) fail(`${file}: broken relative link ${match[1]}`)
  }
}

const typeCounts = Object.fromEntries(
  manifest.enums.documentType.map((type) => [type, entries.filter((entry) => entry.documentType === type).length]),
)
const lifecycleCounts = Object.fromEntries(
  manifest.enums.lifecycle.map((state) => [state, entries.filter((entry) => entry.lifecycle === state).length]),
)

if (failures.length > 0) {
  console.error(`Product document governance audit: FAIL (${failures.length})`)
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('Product document governance audit: PASS')
console.log(`Markdown documents: ${markdownFiles.length}`)
console.log(`Manifest entries: ${entries.length}`)
console.log(`Document types: ${JSON.stringify(typeCounts)}`)
console.log(`Lifecycles: ${JSON.stringify(lifecycleCounts)}`)
console.log('Relative links: PASS')
console.log('Current-state authority: UNIQUE')

