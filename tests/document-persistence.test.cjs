/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function compile(file, dependencies = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => {
    if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`)
    return dependencies[name]
  }, compiledModule, compiledModule.exports, ...Object.values(globals))
  return compiledModule.exports
}

function browserHarness(entries = []) {
  const values = new Map(entries)
  const localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null,
    get length() { return values.size },
  }
  const reload = () => compile('lib/storage/browser-documents.ts', {}, { localStorage, window: new EventTarget() })
  return { ...reload(), reload, values, localStorage }
}
const state = { docType: 'cong-van', docSummary: 'Văn bản kiểm thử', mainContent: 'Nội dung tiếng Việt', folder: 'A' }

test('local documents survive reload; editing uses the same ID; deletion removes versions and recovery caches', () => {
  const h = browserHarness()
  const id = h.saveBrowserDocument(state)
  h.saveBrowserVersion(id, state)
  const reopened = h.reload()
  assert.equal(reopened.getBrowserDocument(id).document.content.mainContent, state.mainContent)
  assert.equal(reopened.saveBrowserDocument({ ...state, mainContent: 'Đã sửa' }, id), id)
  assert.equal(reopened.getBrowserDocuments().length, 1)
  assert.equal(reopened.getBrowserDocument(id).versions.length, 1)
  h.values.set(`doc_${id}`, JSON.stringify(state))
  reopened.deleteBrowserDocument(id)
  assert.equal(h.reload().getBrowserDocuments().length, 0)
  assert.equal(h.reload().getBrowserDocument(id).versions.length, 0)
  assert.equal(h.values.has(`doc_${id}`), false)
})

test('legacy local drafts are recovered once and do not reappear after deletion; cloud caches are excluded', () => {
  const h = browserHarness([['doc_doc_old', JSON.stringify(state)], ['doc_12345678-1234-1234-1234-123456789abc', JSON.stringify(state)]])
  assert.deepEqual(h.getBrowserDocuments().map(doc => doc.id), ['doc_old'])
  h.deleteBrowserDocument('doc_old')
  assert.equal(h.reload().getBrowserDocuments().length, 0)
})

test('failed storage writes do not claim success or change the previously saved content', () => {
  const h = browserHarness()
  const id = h.saveBrowserDocument(state)
  h.localStorage.setItem = () => { throw new Error('QuotaExceededError') }
  assert.throws(() => h.saveBrowserDocument({ ...state, mainContent: 'Unsaved' }, id), /Quota/)
  assert.equal(h.getBrowserDocument(id).document.content.mainContent, state.mainContent)
  assert.throws(() => h.deleteBrowserDocument(id), /Quota/)
  assert.equal(h.getBrowserDocuments().length, 1)
})

test('corrupt storage is not overwritten; folder changes and version deletion persist', () => {
  const h = browserHarness()
  const id = h.saveBrowserDocument(state)
  h.renameBrowserFolder('A', 'B')
  assert.equal(h.reload().getBrowserDocument(id).document.content.folder, 'B')
  const version = h.saveBrowserVersion(id, state)
  h.deleteBrowserVersion(version.id)
  assert.equal(h.reload().getBrowserDocument(id).versions.length, 0)
  h.values.set('vanban_documents_v1', '{bad json')
  assert.throws(() => h.saveBrowserDocument(state))
  assert.equal(h.values.get('vanban_documents_v1'), '{bad json')
})

function cloudHarness() {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test'
  const context = { error: null, data: { id: 'existing-document' }, user: { id: 'account-a' }, authError: null, tenantId: 'tenant-a', provisionError: null, calls: [] }
  const supabase = {
    rpc: async name => { context.calls.push({ operation: 'rpc', name }); return { data: 'personal-tenant', error: context.provisionError } },
    auth: { getUser: async () => ({ data: { user: context.user }, error: context.authError }) },
    from: table => {
      const query = {}
      for (const operation of ['select', 'eq', 'limit', 'order', 'update', 'insert', 'delete']) {
        query[operation] = (...args) => { context.calls.push({ table, operation, args }); return query }
      }
      query.maybeSingle = query.single = async () => table === 'tenant_members'
        ? { data: context.tenantId ? { tenant_id: context.tenantId } : null, error: null }
        : { data: context.data, error: context.error }
      return query
    },
  }
  const actions = compile('lib/actions/documents.ts', {
    '@/lib/supabase/server': { createClient: async () => supabase },
    'next/cache': { revalidatePath: () => {} },
    'next/headers': { cookies: async () => ({ get: () => ({ value: 'true' }) }) },
    '@/lib/user-editor-config': { getEditorConfig: async () => ({ agencies: [], signers: [] }), saveEditorConfig: async value => value },
  })
  return { ...actions, context }
}

test('cloud update failure is reported and does not insert a duplicate or use server disk', async () => {
  const h = cloudHarness()
  h.context.error = new Error('Database unavailable')
  h.context.data = null
  await assert.rejects(h.saveDocument(state, 'existing-document'), /Không thể lưu/)
  assert.equal(h.context.calls.some(call => call.operation === 'insert'), false)
  assert.ok(h.context.calls.some(call => call.operation === 'eq' && call.args[0] === 'tenant_id' && call.args[1] === 'tenant-a'))
})

test('cloud deletion rejects RLS denied or zero-row deletions, then permits a confirmed deletion', async () => {
  const h = cloudHarness()
  h.context.error = new Error('Denied')
  h.context.data = null
  await assert.rejects(h.deleteDocument('existing-document'), /Không thể xóa/)
  h.context.error = null
  await assert.rejects(h.deleteDocument('existing-document'), /Không thể xóa/)
  h.context.data = { id: 'existing-document' }
  await h.deleteDocument('existing-document')
})

test('expired login cannot write using local-mode cookie or shared server fallback', async () => {
  const h = cloudHarness()
  h.context.user = null
  await assert.rejects(h.saveDocument(state), /trình duyệt/)
  assert.equal(h.context.calls.length, 0)
  const local = await h.getDocuments()
  assert.equal(local.storageMode, 'browser')
  assert.deepEqual(local.documents, [])
  h.context.authError = new Error('Network failure')
  await assert.rejects(h.getDocuments(), /xác thực/)
})

test('accounts without a membership provision their own workspace; missing migration fails visibly', async () => {
  const h = cloudHarness()
  h.context.tenantId = null
  assert.equal(await h.saveDocument(state), 'existing-document')
  assert.ok(h.context.calls.some(call => call.name === 'ensure_personal_document_workspace'))
  assert.ok(h.context.calls.some(call => call.operation === 'insert' && call.args[0].tenant_id === 'personal-tenant'))
  h.context.provisionError = new Error('Function missing')
  await assert.rejects(h.saveDocument(state), /20261025_document_workspace.sql/)
})
