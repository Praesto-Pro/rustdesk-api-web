import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// This redesign changes presentation. These files own the existing wire contracts.
const base = process.env.PRC_CONTRACT_BASE || '3998c2a9213fcd047252776d0f0db33e6717026c'
const protectedPaths = [
  'src/api/',
  'src/utils/request.js',
  'src/utils/auth.js',
  'src/utils/peer.js',
  'src/utils/webclient.js',
  'src/utils/webclient/',
  'src/store/user.js',
  'src/store/router.js',
  '.env.development',
  '.env.production',
  'vite.config.js',
]
execFileSync('git', ['diff', '--exit-code', base, 'HEAD', '--', ...protectedPaths], {
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
const oldPackage = JSON.parse(baseline('package.json'))
const newPackage = JSON.parse(current('package.json'))
for (const key of ['dependencies', 'devDependencies']) {
  assert.deepEqual(newPackage[key], oldPackage[key], 'The existing dependency stack must remain unchanged')
}
const oldLock = JSON.parse(baseline('package-lock.json'))
const newLock = JSON.parse(current('package-lock.json'))
for (const [path, entry] of Object.entries(oldLock.packages)) {
  if (path) assert.deepEqual(newLock.packages[path], entry, 'Locked dependency changed: ' + path)
}
assert.deepEqual(Object.keys(newLock.packages).sort(), Object.keys(oldLock.packages).sort())
console.log('PASS: backend adapters, authentication, remote connection helpers, environment, dependency graph, and route contracts are unchanged.')
