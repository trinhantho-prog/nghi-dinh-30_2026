/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function editor(source, dirty = true) {
  const calls = { routes: [], confirmations: 0, driveSaves: 0, librarySaves: 0, diskWrites: 0 }
  let allowLeave = false
  const state = { mainContent: '', docSummary: 'Report' }
  const drive = { isDirty: source === 'drive' && dirty, isSaving: false, flush: async () => { calls.driveSaves++; return true } }
  const dependencies = {
    react: {
      useState: initial => [initial, () => {}], useRef: current => ({ current }),
      useCallback: callback => callback, useEffect: () => {},
    },
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { __esModule: true, default: 'a' },
    'next/navigation': { useRouter: () => ({ push: route => calls.routes.push(route) }) },
    './useDocumentReducer': { useDocumentReducer: () => [state, () => {}] },
    './Sidebar': { __esModule: true, default: 'sidebar' },
    './EditorWorkspace': { __esModule: true, default: 'workspace' },
    './MainContentEditor': { __esModule: true, default: 'main-editor' },
    './exportDocx': { createDocxBlob: async () => new Blob(['Word']) },
    'file-saver': {},
    '@/lib/local-file': { chooseSaveFile: () => Promise.resolve({}), writeSaveFile: async () => { calls.diskWrites++ } },
    '@/lib/actions/documents': { saveDocument: async () => { calls.librarySaves++; return 'doc' } },
    '@/lib/storage/browser-documents': {},
    '@/lib/ai-config': {},
    '@/components/google-drive/useDriveSave': { useDriveSave: () => drive },
  }
  const compiledModule = { exports: {} }
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/components/document-editor/index.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', 'window', 'setTimeout', code)(name => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`)
    return dependencies[name]
  }, compiledModule, compiledModule.exports, { confirm: () => { calls.confirmations++; return allowLeave } }, () => 0)
  const root = compiledModule.exports.default({ agencies: [], signers: [], documentCount: 0, initialData: state, ...(source === 'drive' ? { driveSource: { name: 'Report.docx' } } : { localFileName: 'Report.docx' }) })
  const all = []
  function visit(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(visit); return }
    all.push(node)
    visit(node.props?.children)
    visit(node.props?.sidebar)
  }
  visit(root)
  return {
    calls, allow: () => { allowLeave = true },
    sidebar: all.find(node => node.type === 'sidebar').props,
    back: all.find(node => node.type === 'button' && node.props.children === '← Về Drive')?.props.onClick,
    navigate: () => root.props.onClickCapture({ target: { closest: () => ({ getAttribute: () => '/dashboard' }) }, preventDefault() {}, stopPropagation() {} }),
  }
}

for (const source of ['drive', 'local']) {
  test(`${source}: leaving by link or creating a document asks about unsaved edits without saving`, async () => {
    const h = editor(source)
    await h.navigate()
    await h.sidebar.onNewDocument()
    if (h.back) h.back()
    assert.deepEqual(h.calls.routes, [])
    assert.ok(h.calls.confirmations >= 2)
    h.allow()
    await h.navigate()
    await h.sidebar.onNewDocument()
    if (h.back) h.back()
    assert.deepEqual(h.calls.routes, source === 'drive' ? ['/dashboard', '/documents/new', '/drive'] : ['/dashboard', '/documents/new'])
    assert.equal(h.calls.driveSaves + h.calls.librarySaves + h.calls.diskWrites, 0)
    await h.sidebar.onSave()
    assert.equal(h.calls.librarySaves, 0)
    assert.equal(h.calls.driveSaves, source === 'drive' ? 1 : 0)
    assert.equal(h.calls.diskWrites, source === 'local' ? 1 : 0)
  })
}

test('saved Drive files leave without confirmation or another save', async () => {
  const h = editor('drive', false)
  await h.navigate()
  h.back()
  assert.deepEqual(h.calls.routes, ['/dashboard', '/drive'])
  assert.equal(h.calls.confirmations + h.calls.driveSaves + h.calls.librarySaves, 0)
})
