/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(file, dependencies) {
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', source)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency ${name}`)
    return dependencies[name]
  }, compiledModule, compiledModule.exports)
  return compiledModule.exports
}

test('missing workspace/schema renders an actionable setup problem instead of throwing during page render', async () => {
  for (const message of [
    'Kho văn bản chưa được thiết lập. Quản trị viên cần chạy migrations/20261025_document_workspace.sql trong Supabase.',
    'Không đọc được kho văn bản. Vui lòng kiểm tra cấu hình cơ sở dữ liệu.',
  ]) {
    const actions = { getDocuments: async () => { throw new Error(message) }, getDocument: async () => { throw new Error(message) } }
    const library = load('lib/document-load.ts', { '@/lib/actions/documents': actions })
    for (const result of [await library.loadDocumentLibrary(), await library.loadSavedDocument('test-id')]) {
      assert.equal(result.ok, false)
      assert.equal(result.error.setupRequired, true)
      assert.match(result.error.message, /Supabase/)
      assert.equal('data' in result, false, 'A failed cloud read must not masquerade as an empty local library')
    }
  }
})

test('account configuration/authentication failures stay visible without exposing raw SDK messages', async () => {
  const actions = { getDocuments: async () => { throw new Error('SDK error: secret-token-123') } }
  const library = load('lib/document-load.ts', { '@/lib/actions/documents': actions })
  const result = await library.loadDocumentLibrary()
  assert.equal(result.ok, false)
  assert.equal(result.error.setupRequired, false)
  assert.doesNotMatch(JSON.stringify(result), /secret-token/)
})

test('successful reads retain storage mode and saved data unchanged', async () => {
  const data = { documents: [{ id: 'saved-document' }], storageMode: 'cloud' }
  const library = load('lib/document-load.ts', { '@/lib/actions/documents': { getDocuments: async () => data } })
  const result = await library.loadDocumentLibrary()
  assert.equal(result.ok, true)
  assert.equal(result.data, data)
})

function proxyHarness({ browser = false, path = '/dashboard', constructionError = false, authError = null, user = null } = {}) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test'
  let authCalls = 0
  const moduleExports = load('proxy.ts', {
    '@supabase/ssr': { createServerClient: () => {
      authCalls++
      if (constructionError) throw new Error('Invalid configuration')
      return { auth: { getUser: async () => ({ data: { user }, error: authError }) } }
    } },
    'next/server': { NextResponse: {
      next: () => ({ kind: 'next' }),
      redirect: url => ({ kind: 'redirect', location: String(url) }),
    } },
  })
  return {
    run: () => moduleExports.proxy({ url: `https://app.example${path}`, nextUrl: { pathname: path }, headers: {}, cookies: { get: name => browser && name === 'document_storage' ? { value: 'browser' } : undefined } }),
    calls: () => authCalls,
  }
}

test('proxy lets pages display recovery UI on configuration errors and authentication outages', async () => {
  for (const options of [{ constructionError: true }, { authError: new Error('Network down') }]) {
    const h = proxyHarness(options)
    assert.equal((await h.run()).kind, 'next')
  }
})

test('device workspace skips Auth only for document routes; missing cloud sessions still redirect to login', async () => {
  const local = proxyHarness({ browser: true, constructionError: true })
  assert.equal((await local.run()).kind, 'next')
  assert.equal(local.calls(), 0)
  const cloud = proxyHarness()
  assert.equal((await cloud.run()).location, 'https://app.example/login')
  const profile = proxyHarness({ browser: true, path: '/profile' })
  await profile.run()
  assert.equal(profile.calls(), 1, 'A device preference cannot bypass authentication on account routes')
})

test('storage selection changes only preference cookies and redirects back to the dashboard', async () => {
  const changes = []
  const mode = load('lib/actions/document-storage-mode.ts', {
    'next/headers': { cookies: async () => ({ set: (...args) => changes.push(['set', ...args]), delete: name => changes.push(['delete', name]) }) },
    'next/navigation': { redirect: path => { throw new Error(`redirect:${path}`) } },
  })
  await assert.rejects(mode.selectDocumentStorage('browser'), /redirect:\/dashboard/)
  assert.deepEqual(changes.map(change => change.slice(0, 3)), [['set', 'document_storage', 'browser'], ['set', 'local_mode', 'true']])
  changes.length = 0
  await assert.rejects(mode.selectDocumentStorage('cloud'), /redirect:\/dashboard/)
  assert.deepEqual(changes, [['delete', 'document_storage'], ['delete', 'local_mode']])
  changes.length = 0
  await assert.rejects(mode.selectDocumentStorage('invalid'), /không hợp lệ/)
  assert.deepEqual(changes, [])
})
