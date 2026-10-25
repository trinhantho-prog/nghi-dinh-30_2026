/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const React = require('react')
const { createRoot } = require('react-dom/client')
const { JSDOM } = require('jsdom')

const source = { id: 'file-A', accountId: 'account-A', version: '1', name: 'Report.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
const initial = { mainContent: 'Original' }

async function harness(t, { initialDirty = false, respond = async () => Response.json({ version: '2' }) } = {}) {
  const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' })
  const previous = new Map()
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value })
  }
  const calls = []
  const timers = new Map()
  let timerId = 0
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/google-drive/useDriveAutosave.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const compiled = { exports: {} }
  new Function('require', 'module', 'exports', 'fetch', 'setTimeout', 'clearTimeout', code)(name => {
    if (name === 'react') return React
    if (name === '@/components/document-editor/exportDocx') return { createDocxBlob: async state => new Blob([JSON.stringify(state)], { type: source.mimeType }) }
    throw new Error(`Unexpected dependency: ${name}`)
  }, compiled, compiled.exports, async (url, init) => {
    calls.push({ url, init })
    return respond(url, init)
  }, (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId }, id => timers.delete(id))
  let current
  function Probe({ state }) {
    current = compiled.exports.useDriveAutosave(state, source, initialDirty)
    return null
  }
  const root = createRoot(document.getElementById('root'))
  t.after(async () => {
    await React.act(async () => root.unmount())
    dom.window.close()
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const render = async state => { await React.act(async () => root.render(React.createElement(Probe, { state }))) }
  await render(initial)
  return {
    calls, render,
    get current() { return current },
    async flush() { let result; await React.act(async () => { result = await current.flush() }); return result },
    async autosave() {
      const timer = [...timers.values()].find(item => item.delay === 1500)
      assert.ok(timer, 'A changed document must schedule autosave')
      await React.act(async () => { timer.callback(); await current.flush() })
    },
  }
}

test('manual save uploads state changes without requiring a captured input or click', async t => {
  const h = await harness(t)
  await h.render({ mainContent: 'Edited by an asynchronous action' })
  assert.equal(await h.flush(), true)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, '/api/drive/file/file-A')
  assert.equal(JSON.parse(h.calls[0].init.body.get('state')).mainContent, 'Edited by an asynchronous action')
  assert.equal(h.current.status, 'Đã lưu vào Google Drive ✓')
  assert.equal(localStorage.getItem('drive-draft:account-A:file-A'), null)
})

test('autosave observes document state and does not upload an unchanged opened file', async t => {
  const h = await harness(t)
  assert.equal(await h.flush(), true)
  assert.equal(h.calls.length, 0)
  await h.render({ mainContent: 'Autosaved change' })
  await h.autosave()
  assert.equal(h.calls.length, 1)
})

test('normalized imports are saved even before the first user edit', async t => {
  const h = await harness(t, { initialDirty: true })
  await h.autosave()
  assert.equal(h.calls.length, 1)
})

test('failed saves keep a recovery draft and can be retried', async t => {
  let failed = true
  const h = await harness(t, { respond: async () => failed ? Response.json({ error: 'Drive unavailable' }, { status: 503 }) : Response.json({ version: '2' }) })
  await h.render({ mainContent: 'Keep this draft' })
  assert.equal(await h.flush(), false)
  assert.equal(h.current.error, 'Drive unavailable')
  assert.equal(h.current.isSaving, false)
  assert.equal(JSON.parse(localStorage.getItem('drive-draft:account-A:file-A')).state.mainContent, 'Keep this draft')
  failed = false
  assert.equal(await h.flush(), true)
  assert.equal(h.calls.length, 2)
  assert.equal(h.current.error, '')
})

test('edits made during upload are saved next using the returned version', async t => {
  let finish
  const h = await harness(t, { respond: async () => h.calls.length === 1 ? new Promise(resolve => { finish = resolve }) : Response.json({ version: '3' }) })
  await h.render({ mainContent: 'First change' })
  let pending
  await React.act(async () => { pending = h.current.flush() })
  assert.equal(h.current.isSaving, true)
  await h.render({ mainContent: 'Change during upload' })
  await React.act(async () => { finish(Response.json({ version: '2' })); assert.equal(await pending, true) })
  assert.equal(h.calls.length, 2)
  assert.equal(h.calls[1].init.body.get('version'), '2')
  assert.equal(JSON.parse(h.calls[1].init.body.get('state')).mainContent, 'Change during upload')
  assert.equal(h.current.isSaving, false)
})

test('version conflicts preserve the draft and prevent overwriting a newer remote file', async t => {
  const h = await harness(t, { respond: async () => Response.json({ error: 'File changed on Drive' }, { status: 409 }) })
  await h.render({ mainContent: 'Local edits' })
  assert.equal(await h.flush(), false)
  assert.equal(await h.flush(), false)
  assert.equal(h.calls.length, 1)
  assert.ok(localStorage.getItem('drive-draft:account-A:file-A'))
})
