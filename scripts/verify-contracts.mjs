import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Hardening intentionally changes storage, content handling, and dependency versions.
// Keep API adapters, request transport, deployment environment and route identities stable.
const base = process.env.PRC_CONTRACT_BASE || '4ead17d8a2aecbaa2d8f8d6fd9f1fe35754ff462'
const protectedPaths = [
  'src/api/',
  'src/utils/request.js',
  'src/utils/webclient/',
  '.env.development',
  '.env.production',
]
execFileSync('git', ['diff', '--exit-code', base, '--', ...protectedPaths], {
  stdio: 'inherit',
})
const baseline = file => execFileSync('git', ['show', base + ':' + file], { encoding: 'utf8' })
const current = file => readFileSync(file, 'utf8')
const routeValues = (source, key) => {
  const uncommented = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const pattern = new RegExp('\\b' + key + '\\s*:\\s*[\\x27\\x22]([^\\x27\\x22]+)[\\x27\\x22]', 'g')
  return [...uncommented.matchAll(pattern)].map(match => match[1]).sort()
}
for (const key of ['name', 'path']) {
  assert.deepEqual(
    routeValues(current('src/router/index.js'), key),
    routeValues(baseline('src/router/index.js'), key),
    'Existing route ' + key + ' values must survive the frontend redesign',
  )
}
console.log('PASS: API adapters, request transport, protocol implementations, deployment environment, and route identities remain unchanged.')
