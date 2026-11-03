import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'
const { chromium } = await import(process.env.PRC_PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PRC_PLAYWRIGHT_MODULE).href : 'playwright')

// Synthetic fixtures only. No live backend or remote session is contacted.
const baseline = process.argv.includes('--baseline')
const distArg = process.argv.find(arg => arg.startsWith('--dist='))
const dist = path.resolve(distArg ? distArg.slice(7) : 'dist')
const output = path.resolve('ui-artifacts')
const origin = 'http://127.0.0.1:4173'
const failures = []
const results = []
const contexts = []
const fixtureToken = 'preview-token-for-ui-verification'
await mkdir(output, { recursive: true })

const mime = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
}
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, origin).pathname)
    if (pathname.startsWith('/api/')) {
      res.writeHead(503, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ code: 503, message: 'No backend exists in UI verification.' }))
      return
    }
    let target = path.resolve(dist, '.' + pathname)
    if (target !== dist && !target.startsWith(dist + path.sep)) {
      res.writeHead(403); res.end(); return
    }
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html')
    res.writeHead(200, { 'content-type': mime[path.extname(target)] || 'application/octet-stream' })
    res.end(await readFile(target))
  } catch {
    res.writeHead(404); res.end('Not found')
  }
})
await new Promise((resolve, reject) => {
  server.once('error', reject)
  server.listen(4173, '127.0.0.1', resolve)
})
const browser = await chromium.launch()
const now = Math.floor(Date.now() / 1000)
const peers = [
  { row_id: 1, id: '901234567', hostname: 'Design MacBook', alias: 'Design workstation', username: 'Preview Operator', cpu: 'Apple M3', memory: '16 GB', os: 'macOS', version: '1.3.9', last_online_time: now - 15, last_online_ip: '192.0.2.11', uuid: 'preview-device-01', created_at: '2026-10-01 09:00:00', updated_at: '2026-10-29 14:30:00' },
  { row_id: 2, id: '901234568', hostname: 'Office Desktop', alias: 'Reception', username: 'Preview Operator', cpu: 'Intel Core i5', memory: '16 GB', os: 'Windows 11', version: '1.3.9', last_online_time: now - 300, last_online_ip: '192.0.2.12', uuid: 'preview-device-02', created_at: '2026-10-02 10:00:00', updated_at: '2026-10-29 14:25:00' },
  { row_id: 3, id: '901234569', hostname: 'Support Linux', alias: 'Support station', username: 'Preview Operator', cpu: 'AMD Ryzen 5', memory: '32 GB', os: 'Linux', version: '1.3.9', last_online_time: now - 86400, last_online_ip: '192.0.2.13', uuid: 'preview-device-03', created_at: '2026-10-03 11:00:00', updated_at: '2026-10-28 14:30:00' },
]
const limitedRoutes = ['MyInfo', 'MyPeer', 'MyAddressBookCollection', 'MyAddressBookList', 'MyTagList', 'MyShareRecordList', 'MyLoginLog']

async function fixtureContext({ authenticated = true, limited = false, permissions = null, viewport = { width: 1440, height: 900 }, options = {} } = {}) {
  const context = await browser.newContext({ viewport, locale: 'en-US', colorScheme: 'light', reducedMotion: 'reduce', serviceWorkers: 'block' })
  contexts.push(context)
  const scenario = {
    options: { ops: ['google'], auto_oidc: false, disable_pwd: false, register: true, need_captcha: false, ...options },
    requests: [], unexpected: [], errors: [], peerMode: 'normal', requireCaptchaOnce: false,
  }
  const user = { id: 1, username: 'Preview Operator', nickname: 'Preview Operator', email: 'operator@example.test', token: fixtureToken, role: limited ? 'user' : 'admin', route_names: permissions || (limited ? limitedRoutes : ['*']) }
  await context.addInitScript(({ authenticated, token }) => {
    localStorage.setItem('lang', 'en')
    if (authenticated && !sessionStorage.getItem('prc-seeded')) {
      localStorage.setItem('access_token', token)
      localStorage.setItem('wc-option:local:access_token', token)
      sessionStorage.setItem('prc-seeded', '1')
    }
  }, { authenticated, token: fixtureToken })
  await context.route('**/*', async route => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.origin !== origin) {
      scenario.unexpected.push(request.method() + ' ' + url.origin + url.pathname)
      await route.abort('blockedbyclient')
      return
    }
    if (!url.pathname.startsWith('/api/')) { await route.continue(); return }
    const endpoint = url.pathname.replace(/^\/api\/admin/, '')
    let body = null
    try { body = request.postDataJSON() } catch { body = request.postData() }
    scenario.requests.push({ endpoint, method: request.method(), query: Object.fromEntries(url.searchParams), body, headers: request.headers() })
    const reply = (data, code = 0, message = '') => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ code, data, message }),
    })
    if (endpoint === '/config/admin') return reply({ title: 'Rustdesk API Admin', hello: scenario.options.hello || '' })
    if (endpoint === '/config/app') return reply({ web_client: 1 })
    if (endpoint === '/config/server') return reply({ id_server: 'rendezvous.example.test', key: '', relay_server: 'relay.example.test', api_server: origin })
    if (endpoint === '/user/current') return reply(user)
    if (endpoint === '/login-options') return reply(scenario.options)
    if (endpoint === '/captcha') {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#f0f0f0"/><text x="18" y="28" font-size="22">2468</text></svg>'
      return reply({ captcha: { id: 'fixture-captcha', b64: 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64') } })
    }
    if (endpoint === '/login') {
      if (scenario.requireCaptchaOnce) {
        scenario.requireCaptchaOnce = false
        return reply({}, 110, 'Enter the verification code.')
      }
      return reply(user)
    }
    if (endpoint === '/user/register') return reply(user)
    if (endpoint === '/user/myOauth') return reply([])
    if (endpoint === '/oidc/auth') return reply({ code: 'fixture-oidc-code', url: origin + '/?oidc-preview=1#/login' })
    if (endpoint === '/oidc/auth-query') return reply(user)
    if (endpoint === '/my/peer/list' || endpoint === '/peer/list') {
      if (scenario.peerMode === 'error') return reply({}, 500, 'Preview device request failed.')
      const rows = scenario.peerMode === 'empty' ? [] : peers.filter(row =>
        (!url.searchParams.get('hostname') || row.hostname.toLowerCase().includes(url.searchParams.get('hostname').toLowerCase())) &&
        (!url.searchParams.get('id') || row.id.includes(url.searchParams.get('id'))),
      )
      return reply({ list: rows, total: rows.length })
    }
    if (endpoint.endsWith('/list')) return reply({ list: [], total: 0 })
    scenario.unexpected.push(request.method() + ' ' + url.pathname)
    return reply({}, 500, 'Unexpected mocked endpoint: ' + endpoint)
  })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('pageerror', error => scenario.errors.push(error.message))
  return { context, page, scenario }
}

async function screenshot(page, name, inline = false) {
  await page.screenshot({ path: path.join(output, name + '.png'), fullPage: false, animations: 'disabled' })
  if (!inline) return
  const budgetFile = path.join(output, 'inline-budget.json')
  let used = existsSync(budgetFile) ? JSON.parse(readFileSync(budgetFile, 'utf8')).used : 0
  let encoded = ''
  for (const quality of [55, 45, 35, 25, 15]) {
    encoded = (await page.screenshot({ type: 'jpeg', quality, fullPage: false, animations: 'disabled' })).toString('base64')
    if (encoded.length <= 58000) break
  }
  if (used + encoded.length > 245000) {
    console.log('Inline image budget reached; full PNG remains in artifacts: ' + name)
    return
  }
  used += encoded.length
  await writeFile(budgetFile, JSON.stringify({ used }))
  console.log('::group::Screenshot ' + name)
  console.log('PRC_SCREENSHOT:' + name + ':' + encoded)
  console.log('::endgroup::')
}

async function check(name, run) {
  if (process.argv.includes('--measure-only') && !name.startsWith('Measure cold')) return
  try {
    await run()
    results.push({ name, status: 'passed' })
    console.log('PASS: ' + name)
  } catch (error) {
    failures.push({ name, message: error.stack || error.message })
    results.push({ name, status: 'failed', message: error.message })
    console.error('FAIL: ' + name + '\n' + (error.stack || error.message))
    for (const context of contexts) {
      for (const page of context.pages()) {
        if (!page.isClosed()) await screenshot(page, 'failure-' + failures.length + '-' + contexts.indexOf(context)).catch(() => {})
      }
    }
  }
}
const visible = locator => locator.waitFor({ state: 'visible' })
const hidden = locator => locator.waitFor({ state: 'hidden' })
const hasNoPageOverflow = async page => {
  const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }))
  assert.ok(dimensions.content <= dimensions.viewport + 1, 'Page overflow: ' + JSON.stringify(dimensions))
}
const routeLink = (page, pathname) => page.locator('#primary-navigation').locator('a[href="#' + pathname + '"]')
const cleanScenario = scenario => {
  assert.deepEqual(scenario.unexpected, [], 'All network requests must stay inside known fixtures')
  assert.deepEqual(scenario.errors, [], 'No unhandled browser errors')
}
async function devicesReady(page) {
  await visible(page.locator('.el-table__row, .device-card').filter({ hasText: 'Design MacBook' }).first())
}
async function waitForRoute(page, pathname) {
  await page.waitForFunction(expected => window.location.hash.split('?')[0] === '#' + expected, pathname)
}
const applyFilters = page => page.getByRole('button', { name: /^(Filter|Apply filters)$/ })

try {
  if (baseline) {
    const { page, scenario } = await fixtureContext()
    await page.goto(origin + '/#/my/peer')
    await devicesReady(page)
    await screenshot(page, 'before-desktop-devices')
    await page.setViewportSize({ width: 768, height: 1024 })
    await screenshot(page, 'before-tablet-devices')
    await page.setViewportSize({ width: 390, height: 844 })
    await screenshot(page, 'before-mobile-devices')
    const auth = await fixtureContext({ authenticated: false })
    await auth.page.goto(origin + '/#/login')
    await visible(auth.page.locator('input[type="password"]'))
    await screenshot(auth.page, 'before-login')
    cleanScenario(scenario)
    cleanScenario(auth.scenario)
    console.log('PASS: Original interface captured with synthetic data.')
  } else {
    const desktop = await fixtureContext()
    const { page, scenario } = desktop
    await page.goto(origin + '/#/my/peer')
    await devicesReady(page)

    await check('Branded desktop shell, task groups, active route, and bounded layout', async () => {
      await visible(page.locator('#primary-navigation'))
      assert.ok((await page.title()).includes('Praesto Remote Control'))
      assert.ok((await page.locator('body').innerText()).replace(/\s+/g, ' ').includes('Praesto Remote Control'))
      for (const group of ['Workspace', 'Fleet', 'Activity', 'Administration', 'Account']) {
        await visible(page.locator('#primary-navigation').getByText(group, { exact: true }))
      }
      assert.equal(await routeLink(page, '/my/peer').getAttribute('aria-current'), 'page')
      await hasNoPageOverflow(page)
      await screenshot(page, 'after-desktop-devices', true)
    })

    await check('Skip link focuses content without changing the hash route', async () => {
      const before = page.url()
      await page.getByRole('link', { name: 'Skip to content', exact: true }).focus()
      await page.keyboard.press('Enter')
      assert.equal(page.url(), before)
      assert.equal(await page.locator('#main-content').evaluate(element => element === document.activeElement), true)
    })

    await check('Device details retain a working accessible dialog', async () => {
      await page.getByRole('button', { name: /^More actions for / }).first().click()
      await page.getByRole('menuitem', { name: 'View', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await visible(dialog)
      const values = await dialog.locator('input').evaluateAll(inputs => inputs.map(input => input.value))
      assert.ok(values.includes('Design MacBook'), 'The details dialog must show the selected device')
      await page.keyboard.press('Escape')
      await hidden(dialog)
    })

    await check('Device filtering uses the original hostname query and supports an empty result', async () => {
      const hostname = page.getByLabel('Hostname', { exact: true }).first()
      await hostname.fill('Office')
      await applyFilters(page).click()
      await visible(page.locator('.el-table__row').filter({ hasText: 'Office Desktop' }).first())
      await hidden(page.locator('.el-table__row').filter({ hasText: 'Design MacBook' }).first())
      assert.ok(scenario.requests.some(request => request.endpoint === '/my/peer/list' && request.query.hostname === 'Office'))
      await hostname.fill('No matching device')
      await applyFilters(page).click()
      await visible(page.getByText('No devices found', { exact: true }))
      await screenshot(page, 'after-empty-devices')
      await hostname.fill('')
      await applyFilters(page).click()
      await devicesReady(page)
    })

    await check('Device request failures retain retry and recover', async () => {
      scenario.peerMode = 'error'
      await applyFilters(page).click()
      await visible(page.getByText('Devices could not be loaded.', { exact: true }))
      await screenshot(page, 'after-device-error')
      scenario.peerMode = 'normal'
      await page.getByRole('button', { name: 'Retry', exact: true }).click()
      await hidden(page.getByText('Devices could not be loaded.', { exact: true }))
      await devicesReady(page)
    })

    await check('Keyboard page search, route navigation, and hash refresh', async () => {
      const trigger = page.getByRole('button', { name: 'Find a page', exact: true })
      await trigger.focus()
      await page.keyboard.press('Control+k')
      const dialog = page.getByRole('dialog', { name: 'Find a page', exact: true })
      await visible(dialog)
      const search = dialog.getByRole('combobox', { name: 'Find a page', exact: true })
      await search.fill('All devices')
      await dialog.getByRole('option', { name: /All devices/ }).click()
      await waitForRoute(page, '/user/peer')
      await hidden(dialog)
      assert.equal(await routeLink(page, '/user/peer').getAttribute('aria-current'), 'page')
      await page.reload()
      await devicesReady(page)
      assert.equal(await routeLink(page, '/user/peer').getAttribute('aria-current'), 'page')
      await trigger.click()
      await visible(dialog)
      await page.keyboard.press('Escape')
      await hidden(dialog)
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true)
    })

    await check('Primary routes remain reachable from navigation', async () => {
      for (const pathname of ['/user/index', '/auditConn', '/my/address_book', '/']) {
        await routeLink(page, pathname).click()
        await waitForRoute(page, pathname)
        assert.equal(await routeLink(page, pathname).getAttribute('aria-current'), 'page')
        const heading = (await page.locator('h1').first().innerText()).trim()
        assert.ok(heading.length > 0)
        await visible(page.getByRole('navigation', { name: 'Open pages', exact: true }).getByRole('link', { name: heading, exact: true }))
      }
      await routeLink(page, '/my/peer').click()
      await devicesReady(page)
    })

    await check('Language switching preserves translated navigation destinations', async () => {
      await page.getByRole('button', { name: 'Change language', exact: true }).click()
      await page.getByRole('menuitem', { name: 'Français', exact: true }).click()
      await visible(routeLink(page, '/my/peer').filter({ hasText: 'Mon appareil' }))
      assert.equal(await page.locator('h1').first().innerText(), 'Mon appareil')
      assert.equal(await routeLink(page, '/user/index').innerText(), 'Utilisateurs')
      await page.getByRole('button', { name: 'Change language', exact: true }).click()
      await page.getByRole('menuitem', { name: /English/ }).click()
      assert.equal(await page.locator('h1').first().innerText(), 'My devices')
    })

    await check('Theme toggle persists and keeps readable application content', async () => {
      await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click()
      await visible(page.getByRole('button', { name: 'Switch to light theme', exact: true }))
      await screenshot(page, 'after-desktop-dark', true)
      await page.reload()
      await devicesReady(page)
      await visible(page.getByRole('button', { name: 'Switch to light theme', exact: true }))
      await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
    })

    for (const viewport of [{ width: 768, height: 1024 }, { width: 390, height: 844 }]) {
      await check('Navigation drawer and keyboard return at ' + viewport.width + 'px', async () => {
        await page.setViewportSize(viewport)
        const opener = page.getByRole('button', { name: 'Open navigation', exact: true })
        await visible(opener)
        await hasNoPageOverflow(page)
        await screenshot(page, 'after-' + viewport.width + '-devices', viewport.width === 390)
        await opener.click()
        await visible(routeLink(page, '/my/peer'))
        if (viewport.width === 390) await screenshot(page, 'after-mobile-navigation', true)
        await page.keyboard.press('Escape')
        await hidden(page.getByRole('button', { name: 'Close navigation', exact: true }))
        assert.equal(await opener.evaluate(element => element === document.activeElement), true)
        await opener.click()
        await routeLink(page, '/user/peer').click()
        await waitForRoute(page, '/user/peer')
        await devicesReady(page)
        if (viewport.width === 390) {
          const adminCard = page.getByRole('article', { name: 'Design MacBook', exact: true })
          await visible(adminCard)
          await adminCard.locator('summary').click()
          await visible(adminCard.getByText('Group', { exact: true }))
        }
        await hidden(page.getByRole('button', { name: 'Close navigation', exact: true }))
        await hasNoPageOverflow(page)
        await opener.click()
        await routeLink(page, '/my/peer').click()
        await waitForRoute(page, '/my/peer')
      })
    }

    await check('Phone device cards keep identity, selection, details, and actions accessible', async () => {
      await devicesReady(page)
      const card = page.getByRole('article', { name: 'Design MacBook', exact: true })
      await visible(card)
      const heading = card.getByRole('heading', { name: 'Design MacBook', exact: true })
      assert.equal(await heading.evaluate(element => element.scrollWidth <= element.clientWidth + 1), true)
      await visible(card.getByText('901234567', { exact: true }))
      const selection = card.getByRole('checkbox', { name: 'Select device 901234567', exact: true })
      await card.locator('.el-checkbox').click()
      assert.equal(await selection.isChecked(), true)
      await visible(page.getByText('1 selected', { exact: true }))
      await selection.focus()
      await page.keyboard.press('Space')
      assert.equal(await selection.isChecked(), false)
      await card.locator('summary').click()
      await visible(card.getByText('Apple M3', { exact: true }))
      await card.getByRole('button', { name: 'More actions for 901234567', exact: true }).click()
      await page.getByRole('menuitem', { name: 'View', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await visible(dialog)
      await hasNoPageOverflow(page)
      await page.keyboard.press('Escape')
      await hidden(dialog)
    })

    await check('Limited permissions hide administrative navigation and search results', async () => {
      const limited = await fixtureContext({ limited: true })
      await limited.page.goto(origin + '/#/my/peer')
      await devicesReady(limited.page)
      assert.equal(await routeLink(limited.page, '/user/peer').count(), 0)
      assert.equal(await routeLink(limited.page, '/user/index').count(), 0)
      assert.equal(await routeLink(limited.page, '/auditConn').count(), 0)
      await limited.page.getByRole('button', { name: 'Find a page', exact: true }).click()
      const dialog = limited.page.getByRole('dialog', { name: 'Find a page', exact: true })
      await dialog.getByRole('combobox', { name: 'Find a page', exact: true }).fill('All devices')
      assert.equal(await dialog.getByRole('option', { name: /All devices/ }).count(), 0)
      await limited.page.keyboard.press('Escape')
      await limited.page.goto(origin + '/#/user/peer')
      await limited.page.waitForURL('**/#/404')
      cleanScenario(limited.scenario)
      await limited.context.close()
    })

    await check('Sign-in branding, captcha retry, password payload, and token storage', async () => {
      const auth = await fixtureContext({ authenticated: false })
      await auth.page.goto(origin + '/#/login')
      await visible(auth.page.getByLabel('Username', { exact: true }))
      assert.ok((await auth.page.title()).includes('Praesto Remote Control'))
      assert.ok((await auth.page.locator('body').innerText()).replace(/\s+/g, ' ').includes('Praesto Remote Control'))
      await hasNoPageOverflow(auth.page)
      await screenshot(auth.page, 'after-login', true)
      auth.scenario.requireCaptchaOnce = true
      await auth.page.getByLabel('Username', { exact: true }).fill('preview.operator')
      await auth.page.getByLabel('Password', { exact: true }).fill('fixture-password')
      await auth.page.getByRole('button', { name: /^(Sign in|Log in|Login)$/i }).click()
      await visible(auth.page.getByLabel(/^(Captcha|Verification code)$/i))
      await auth.page.getByLabel(/^(Captcha|Verification code)$/i).fill('2468')
      await auth.page.getByRole('button', { name: /^(Sign in|Log in|Login)$/i }).click()
      await waitForRoute(auth.page, '/')
      const attempt = auth.scenario.requests.filter(request => request.endpoint === '/login').at(-1)
      assert.equal(attempt.method, 'POST')
      assert.deepEqual(Object.keys(attempt.body).sort(), ['captcha', 'captcha_id', 'password', 'platform', 'username'])
      assert.equal(attempt.body.username, 'preview.operator')
      assert.equal(attempt.body.password, 'fixture-password')
      assert.equal(attempt.body.captcha_id, 'fixture-captcha')
      assert.equal(attempt.body.captcha, '2468')
      assert.equal(await auth.page.evaluate(() => localStorage.getItem('access_token')), fixtureToken)
      assert.equal(await auth.page.evaluate(() => localStorage.getItem('wc-option:local:access_token')), fixtureToken)
      cleanScenario(auth.scenario)
      await auth.context.close()
    })

    await check('Server registration and password-disabled options remain effective', async () => {
      const auth = await fixtureContext({ authenticated: false, options: { register: true } })
      await auth.page.goto(origin + '/#/login')
      const registration = auth.page.getByRole('button', { name: /^(Create account|Register)$/i }).or(auth.page.getByRole('link', { name: /^(Create account|Register)$/i }))
      await visible(registration)
      await registration.click()
      await waitForRoute(auth.page, '/register')
      await visible(auth.page.getByLabel('Username', { exact: true }))
      await auth.page.setViewportSize({ width: 390, height: 844 })
      await hasNoPageOverflow(auth.page)
      await screenshot(auth.page, 'after-registration-mobile')
      auth.scenario.options.register = false
      auth.scenario.options.disable_pwd = true
      await auth.page.goto(origin + '/#/login')
      await visible(auth.page.getByRole('button', { name: /google/i }))
      assert.equal(await auth.page.locator('input[type="password"]').count(), 0)
      assert.equal(await registration.count(), 0)
      cleanScenario(auth.scenario)
      await auth.context.close()
    })

    await check('OIDC initiation and callback preserve their existing payloads', async () => {
      const auth = await fixtureContext({ authenticated: false, options: { disable_pwd: true, register: false } })
      await auth.page.goto(origin + '/#/login')
      await auth.page.getByRole('button', { name: /google/i }).click()
      await waitForRoute(auth.page, '/')
      const start = auth.scenario.requests.find(request => request.endpoint === '/oidc/auth')
      assert.equal(start.method, 'POST')
      assert.equal(start.body.op, 'google')
      assert.equal(start.body.uuid, '')
      assert.equal(start.body.deviceInfo.type, 'webadmin')
      assert.ok(start.body.deviceInfo.name)
      assert.ok(start.body.deviceInfo.os)
      assert.ok(start.body.id)
      const callback = auth.scenario.requests.find(request => request.endpoint === '/oidc/auth-query')
      assert.equal(callback.method, 'GET')
      assert.equal(callback.query.code, 'fixture-oidc-code')
      assert.equal(callback.query.uuid, '')
      assert.equal(await auth.page.evaluate(() => localStorage.getItem('oidc_code')), null)
      assert.equal(await auth.page.evaluate(() => localStorage.getItem('access_token')), fixtureToken)
      cleanScenario(auth.scenario)
      await auth.context.close()
    })
    await check('Sign-in selects an authorized landing page and preserves explicit return queries', async () => {
      for (const redirect of ['', '/my/peer?id=901234567']) {
        const auth = await fixtureContext({ authenticated: false, permissions: ['MyPeer'] })
        await auth.page.goto(origin + '/#/login' + (redirect ? '?redirect=' + encodeURIComponent(redirect) : ''))
        await auth.page.getByLabel('Username', { exact: true }).fill('preview.operator')
        await auth.page.getByLabel('Password', { exact: true }).fill('fixture-password')
        await auth.page.getByRole('button', { name: 'Sign in', exact: true }).click()
        await waitForRoute(auth.page, '/my/peer')
        assert.equal(new URL(auth.page.url()).hash, '#' + (redirect || '/my/peer'))
        await devicesReady(auth.page)
        cleanScenario(auth.scenario)
        await auth.context.close()
      }
    })

    await check('Registration retains its payload and uses an authorized landing page', async () => {
      const auth = await fixtureContext({ authenticated: false, permissions: ['MyPeer'] })
      await auth.page.goto(origin + '/#/register')
      await auth.page.getByLabel('Username', { exact: true }).fill('preview.operator')
      await auth.page.getByLabel('Email', { exact: true }).fill('operator@example.test')
      await auth.page.getByLabel('Password', { exact: true }).fill('fixture-password')
      await auth.page.getByLabel('Confirm Password', { exact: true }).fill('fixture-password')
      await auth.page.getByRole('button', { name: 'Create account', exact: true }).click()
      await waitForRoute(auth.page, '/my/peer')
      const request = auth.scenario.requests.find(item => item.endpoint === '/user/register')
      assert.equal(request.method, 'POST')
      assert.deepEqual(request.body, { username: 'preview.operator', email: 'operator@example.test', password: 'fixture-password', confirm_password: 'fixture-password' })
      await devicesReady(auth.page)
      cleanScenario(auth.scenario)
      await auth.context.close()
    })

    await check('Automatic SSO is independent of password-only captcha options', async () => {
      const auth = await fixtureContext({ authenticated: false, options: { disable_pwd: true, register: false, need_captcha: true, auto_oidc: true } })
      await auth.page.goto(origin + '/#/login')
      await waitForRoute(auth.page, '/')
      assert.equal(auth.scenario.requests.filter(request => request.endpoint === '/captcha').length, 0)
      assert.equal(auth.scenario.requests.filter(request => request.endpoint === '/oidc/auth').length, 1)
      cleanScenario(auth.scenario)
      await auth.context.close()
    })
    await check('Administrator Markdown preserves formatting and removes active HTML', async () => {
      const auth = await fixtureContext({ options: { hello: '**Safe heading** <img src="data:image/png;base64," onerror="window.xssExecuted=true"><script>window.xssExecuted=true</script><a href="javascript:alert(1)">Unsafe</a>' } })
      await auth.page.goto(origin + '/#/')
      await visible(auth.page.locator('.account-message strong'))
      assert.equal(await auth.page.locator('.account-message strong').textContent(), 'Safe heading')
      assert.equal(await auth.page.locator('.account-message script, .account-message [onerror], .account-message a[href^="javascript:"]').count(), 0)
      assert.equal(await auth.page.evaluate(() => window.xssExecuted), undefined)
      cleanScenario(auth.scenario)
      await auth.context.close()
    })
    await check('An account with zero permissions loads its session only once', async () => {
      const auth = await fixtureContext({ permissions: [] })
      await auth.page.goto(origin + '/#/')
      await visible(auth.page.locator('body'))
      await auth.page.waitForTimeout(500)
      assert.equal(auth.scenario.requests.filter(item => item.endpoint === '/user/current').length, 1)
      cleanScenario(auth.scenario)
      await auth.context.close()
    })
    await check('Logout clears both browser tokens and cached identity', async () => {
      const auth = await fixtureContext()
      await auth.page.goto(origin + '/#/my/peer')
      await devicesReady(auth.page)
      await auth.page.evaluate(() => {
        localStorage.setItem('wc-option:local:access_token', 'stale-webclient-token')
        localStorage.setItem('user_info', '{"name":"cached identity"}')
      })
      await auth.page.getByRole('button', { name: 'Account menu', exact: true }).click()
      await auth.page.getByRole('menuitem', { name: /sign out/i }).click()
      await waitForRoute(auth.page, '/login')
      for (const key of ['access_token', 'wc-option:local:access_token', 'user_info', 'oidc_code', 'oidc_code_expiry']) {
        assert.equal(await auth.page.evaluate(key => localStorage.getItem(key), key), null)
      }
      cleanScenario(auth.scenario)
      await auth.context.close()
    })
    await check('Measure cold sign-in and device-page assets', async () => {
      const measurements = []
      for (const [label, authenticated, route] of [['sign-in', false, '/login'], ['devices', true, '/my/peer']]) {
        const auth = await fixtureContext({ authenticated })
        const assets = new Set()
        auth.page.on('request', request => {
          const url = new URL(request.url())
          if (url.origin === origin && /\.(js|css)$/.test(url.pathname)) assets.add(url.pathname)
        })
        await auth.page.goto(origin + '/#' + route)
        await auth.page.waitForLoadState('networkidle')
        let rawBytes = 0, gzipBytes = 0
        for (const asset of assets) {
          const body = await readFile(path.join(dist, asset))
          rawBytes += body.length
          gzipBytes += gzipSync(body, { level: 9 }).length
        }
        measurements.push({ label, rawBytes, gzipBytes, assets: [...assets].sort() })
        cleanScenario(auth.scenario)
        await auth.context.close()
      }
      await writeFile(path.join(output, 'route-assets.json'), JSON.stringify({ dist, measurements, note: 'Cold-context JS/CSS requests; deterministic per-file gzip level 9, not network latency.' }, null, 2))
    })
    await check('Browser errors and unexpected network activity', async () => cleanScenario(scenario))
  }
} catch (error) {
  failures.push({ name: 'Verification setup', message: error.stack || error.message })
  console.error(error.stack || error.message)
} finally {
  await writeFile(path.join(output, baseline ? 'before-results.json' : 'results.json'), JSON.stringify({ fixtureDataOnly: true, backendContacted: false, baseline, results, failures }, null, 2))
  for (const context of contexts) await context.close().catch(() => {})
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
if (failures.length) process.exitCode = 1
