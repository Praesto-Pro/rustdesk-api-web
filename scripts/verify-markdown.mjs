import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseAdministratorMarkdown } from '../src/utils/admin-markdown.js'

// Fixed Marked 15.0.12 output, captured before upgrading the message renderer.
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/administrator-markdown.json', import.meta.url), 'utf8'))
for (const { name, markdown, html } of fixtures) {
  assert.equal(parseAdministratorMarkdown(markdown), html, name)
}
assert.equal(parseAdministratorMarkdown(''), '')
assert.equal(parseAdministratorMarkdown('Welcome, **operator**.'), '<p>Welcome, <strong>operator</strong>.</p>\n')
console.log(`PASS: ${fixtures.length} administrator-message rendering regressions, empty messages, and ordinary Markdown.`)
