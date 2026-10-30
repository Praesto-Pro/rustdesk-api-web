import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getToken, setToken, removeToken, getCode, setCode } from '../src/utils/auth.js'
import { jsonToCsv } from '../src/utils/file.js'
import { parsePeerCsv } from '../src/utils/peer-csv.js'
import { httpUrl } from '../src/utils/safe-url.js'

const values = new Map()
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) }
globalThis.window = { location: { origin: 'https://example.test' } }
setToken('secret')
assert.equal(getToken(), 'secret')
removeToken()
assert.equal(getToken(), null)
assert.equal(localStorage.getItem('wc-option:local:access_token'), null)
setCode('valid-code')
assert.equal(getCode(), 'valid-code')
for (const expiry of ['', 'invalid', 'Infinity', String(Date.now() - 1), String(Date.now() + 120_000), '123abc']) {
  localStorage.setItem('oidc_code', 'stale-code')
  localStorage.setItem('oidc_code_expiry', expiry)
  assert.equal(getCode(), null)
  assert.equal(localStorage.getItem('oidc_code'), null)
}
for (const url of ['javascript:alert(1)', 'data:text/html,test', 'https://user:password@example.test']) assert.throws(() => httpUrl(url))
assert.equal(httpUrl('/webclient2/').origin, 'https://example.test')
const csv = await jsonToCsv([{ id: '=cmd()', hostname: 'A,"B"\nC', memory: null, username: '\t@SUM(A1)' }]).text()
assert.ok(csv.includes("'=cmd()"))
assert.ok(csv.includes("'\t@SUM(A1)"))
const parsed = parsePeerCsv(csv)
assert.equal(parsed[0].hostname, 'A,"B"\nC')
assert.equal(parsed[0].memory, '')
for (const text of ['hostname\nmissing-id', 'id,id\n1,2', 'id,hostname\n1,a,b', 'id,group_id\n1,2abc', 'id,hostname\n1,"unclosed']) assert.throws(() => parsePeerCsv(text))
assert.deepEqual(parsePeerCsv('id,hostname,unknown\r\n1,"Quoted, name",ignored'), [{ id: '1', hostname: 'Quoted, name' }])
assert.equal(await jsonToCsv([]).text(), '')
const source = readFileSync('src/store/user.js', 'utf8')
assert.ok(!source.includes("console.log('login'"))
assert.ok(source.includes('this.$reset()'))
console.log('PASS: token cleanup, OIDC expiry, external URL schemes, CSV formula neutralization, CSV parsing and validation.')
