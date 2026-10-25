/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function callback({ user = { id: 'google-user' }, membership = null, error = null, unavailable = false } = {}) {
  const deleted = []
  const filters = []
  const supabase = {
    auth: { exchangeCodeForSession: async () => ({ error }), getUser: async () => ({ data: { user } }) },
    from: () => ({ select: () => ({ eq: (key, value) => { filters.push([key, value]); return { maybeSingle: async () => ({ data: membership }) } } }) }),
  }
  const dependencies = {
    '@/lib/supabase/server': { createClient: async () => { if (unavailable) throw new Error('Not configured'); return supabase } },
    'next/headers': { cookies: async () => ({ delete: name => deleted.push(name) }) },
    'next/server': { NextResponse: { redirect: url => Response.redirect(url) } },
  }
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/(auth)/auth/callback/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const compiledModule = { exports: {} }
  new Function('require', 'module', 'exports', source)(name => dependencies[name], compiledModule, compiledModule.exports)
  return { GET: compiledModule.exports.GET, deleted, filters }
}

test('new Google users reach their profile and leave local mode after code exchange', async () => {
  const h = callback()
  const response = await h.GET(new Request('https://app.example/auth/callback?code=test'))
  assert.equal(response.headers.get('location'), 'https://app.example/profile')
  assert.deepEqual(h.deleted, ['local_mode', 'document_storage'])
  assert.deepEqual(h.filters, [['user_id', 'google-user']])
})

test('existing organization members return to their dashboard', async () => {
  const h = callback({ membership: { tenant_id: 'tenant-A' } })
  const response = await h.GET(new Request('https://app.example/auth/callback?code=test'))
  assert.equal(response.headers.get('location'), 'https://app.example/dashboard')
})

test('OAuth errors and missing configuration return a login error', async () => {
  for (const options of [{ error: new Error('Expired code') }, { unavailable: true }, { user: null }]) {
    const h = callback(options)
    const response = await h.GET(new Request('https://app.example/auth/callback?code=test'))
    assert.equal(response.headers.get('location'), 'https://app.example/login?error=auth_failed')
  }
  const h = callback()
  const response = await h.GET(new Request('https://app.example/auth/callback?error=access_denied'))
  assert.equal(response.headers.get('location'), 'https://app.example/login?error=auth_failed')
  assert.deepEqual(h.deleted, [])
})
