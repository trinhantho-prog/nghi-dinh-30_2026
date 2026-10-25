/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
const config = label => ({ agencies: [{ upper: label, main: label, location: 'Cao Lãnh', suffix: 'CL' }], signers: [{ position: 'CHỦ TỊCH', name: label }] })

function harness() {
  const accounts = new Map([
    ['A', { id: 'A', user_metadata: { display_name: 'User A' } }],
    ['B', { id: 'B', user_metadata: { display_name: 'User B' } }],
  ])
  const context = { account: 'A', authError: null, saveError: null, localMode: false, localConfig: config('Local'), localWrites: 0, updates: [] }
  const supabase = { auth: {
    getUser: async () => ({ data: { user: accounts.get(context.account) || null }, error: context.authError }),
    updateUser: async ({ data }) => {
      context.updates.push({ account: context.account, data })
      if (context.saveError) return { data: { user: null }, error: context.saveError }
      const user = accounts.get(context.account)
      user.user_metadata = { ...user.user_metadata, ...data }
      return { data: { user }, error: null }
    },
  } }
  const dependencies = {
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@/lib/storage/local-db': {
      getLocalDocuments: async () => context.localConfig,
      saveLocalConfig: async value => { context.localConfig = value; context.localWrites++ },
    },
    'next/headers': { cookies: async () => ({ get: () => context.localMode ? { value: 'true' } : undefined }) },
  }
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/user-editor-config.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', source)(name => {
    if (!dependencies[name]) throw new Error(`Unexpected dependency ${name}`)
    return dependencies[name]
  }, compiledModule, compiledModule.exports)
  return { ...compiledModule.exports, context, accounts }
}

test('Gmail accounts retain separate configurations across account switches and reloads', async () => {
  const h = harness()
  assert.deepEqual(await h.getEditorConfig(), { agencies: [], signers: [] })
  await h.saveEditorConfig(config('Agency A'))
  h.context.account = 'B'
  assert.deepEqual(await h.getEditorConfig(), { agencies: [], signers: [] })
  await h.saveEditorConfig(config('Agency B'))
  assert.deepEqual(await h.getEditorConfig(), config('Agency B'))
  h.context.account = 'A'
  assert.deepEqual(await h.getEditorConfig(), config('Agency A'))
  assert.equal(h.accounts.get('A').user_metadata.display_name, 'User A')
  assert.equal(h.context.localWrites, 0)
  assert.deepEqual(h.context.localConfig, config('Local'))
})

test('cleared lists remain empty instead of inheriting local or another account settings', async () => {
  const h = harness()
  await h.saveEditorConfig({ agencies: [], signers: [] })
  assert.deepEqual(await h.getEditorConfig(), { agencies: [], signers: [] })
})

test('cloud write failures are reported and never fall back to shared local storage', async () => {
  const h = harness()
  h.context.saveError = new Error('Network unavailable')
  await assert.rejects(h.saveEditorConfig(config('Failed')), /Không thể lưu/)
  assert.equal(h.context.localWrites, 0)
  assert.equal(h.accounts.get('A').user_metadata.document_config, undefined)
})

test('authentication errors never read or overwrite shared configuration', async () => {
  const h = harness()
  h.context.authError = new Error('Network unavailable')
  await assert.rejects(h.getEditorConfig(), /Không xác thực/)
  await assert.rejects(h.saveEditorConfig(config('Failed')), /Không xác thực/)
  assert.equal(h.context.updates.length, 0)
  assert.equal(h.context.localWrites, 0)
})

test('expired sessions require sign-in instead of silently saving as a local user', async () => {
  const h = harness()
  h.context.account = null
  h.context.authError = { name: 'AuthSessionMissingError' }
  await assert.rejects(h.saveEditorConfig(config('Failed')), /hết hạn/)
  assert.equal(h.context.localWrites, 0)
})

test('explicit local mode continues using the existing local configuration', async () => {
  const h = harness()
  h.context.account = null
  h.context.localMode = true
  assert.deepEqual(await h.getEditorConfig(), config('Local'))
  await h.saveEditorConfig(config('Updated local'))
  assert.deepEqual(await h.getEditorConfig(), config('Updated local'))
  assert.equal(h.context.localWrites, 1)
})

test('invalid configuration is rejected before writing and known fields are normalized', async () => {
  const h = harness()
  for (const value of [null, { agencies: {}, signers: [] }, { agencies: [], signers: [{ name: 123 }] }, { agencies: new Array(101).fill({}), signers: [] }]) {
    await assert.rejects(h.saveEditorConfig(value))
  }
  assert.equal(h.context.updates.length, 0)
  assert.deepEqual(h.validateEditorConfig({ agencies: [{ upper: ' U ', main: ' M ', location: ' L ', unrelated: true }], signers: [] }), { agencies: [{ upper: 'U', main: 'M', location: 'L', suffix: '' }], signers: [] })
})
