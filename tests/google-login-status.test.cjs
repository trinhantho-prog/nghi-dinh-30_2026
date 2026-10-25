/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/google-login-status.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const compiledModule = { exports: {} }
new Function('module', 'exports', source)(compiledModule, compiledModule.exports)
const { googleLoginStatus } = compiledModule.exports
const url = 'https://projecta.supabase.co'
const jwt = ref => `header.${Buffer.from(JSON.stringify({ ref, role: 'anon' })).toString('base64url')}.signature`

test('standard publishable environment variable works and legacy anon remains supported', async () => {
  const names = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
  const original = names.map(name => process.env[name])
  try {
    process.env.NEXT_PUBLIC_SUPABASE_URL = url
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt('oldproject')
    const check = expected => async (_endpoint, options) => {
      assert.equal(options.headers.apikey, expected)
      return Response.json({ external: { google: true } })
    }
    assert.deepEqual(await googleLoginStatus(undefined, undefined, check('sb_publishable_test')), { ok: true })
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = jwt('projecta')
    assert.deepEqual(await googleLoginStatus(undefined, undefined, check(jwt('projecta'))), { ok: true })
  } finally {
    names.forEach((name, index) => { if (original[index] === undefined) delete process.env[name]; else process.env[name] = original[index] })
  }
})

test('missing or malformed configuration never starts OAuth', async () => {
  assert.equal((await googleLoginStatus('', '')).ok, false)
  assert.match((await googleLoginStatus('bad-url', 'key')).error, /HTTP/)
  assert.equal((await googleLoginStatus('file:///etc/passwd', 'key')).ok, false)
})

test('mismatched project URL and public key are rejected before network access', async () => {
  const key = jwt('projectb')
  const result = await googleLoginStatus(url, key, async () => { throw new Error('Unexpected network call') })
  assert.match(result.error, /hai dự án khác nhau/)
  assert.ok(!JSON.stringify(result).includes(key))
})

test('DNS failures give an actionable message without leaking credentials', async () => {
  const key = jwt('projecta')
  const result = await googleLoginStatus(url, key, async () => { throw new TypeError('fetch failed', { cause: { code: 'ENOTFOUND' } }) })
  assert.match(result.error, /DNS/)
  assert.match(result.error, /projecta.supabase.co/)
  assert.ok(!JSON.stringify(result).includes(key))
})

test('invalid keys, paused projects, disabled providers and timeouts stop login', async () => {
  for (const [status, body, message] of [[401, {}, /khóa public/], [503, {}, /trạng thái dự án/], [200, { external: { google: false } }, /chưa bật/]]) {
    const result = await googleLoginStatus(url, 'sb_publishable_test', async () => Response.json(body, { status }))
    assert.equal(result.ok, false)
    assert.match(result.error, message)
  }
  const result = await googleLoginStatus(url, 'sb_publishable_test', async () => { throw new DOMException('Timeout', 'TimeoutError') })
  assert.equal(result.ok, false)
})

test('only a reachable service with Google enabled allows OAuth', async () => {
  const key = jwt('projecta')
  const result = await googleLoginStatus(url, key, async (endpoint, options) => {
    assert.equal(String(endpoint), `${url}/auth/v1/settings`)
    assert.equal(options.headers.apikey, key)
    assert.equal(options.cache, 'no-store')
    assert.ok(options.signal instanceof AbortSignal)
    return Response.json({ external: { google: true } })
  })
  assert.deepEqual(result, { ok: true })
})
