/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function load(window = {}, importDocx = async () => ({}), fetch = async () => { throw new Error('Unexpected network request') }) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib/local-file.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const compiledModule = { exports: {} }
  const requireMock = name => {
    if (name === '@/types') return { DEFAULT_DOCUMENT_STATE: { docType: 'cong-van' } }
    if (name === './drive-document') return { importedHtmlToDocument: async (html, name) => ({ html, name }) }
    if (name === './import-docx') return { importDocx }
    if (name === './normalize-imported-document') return { normalizeImportedDocument: state => ({ ...state, normalized: true }) }
    throw new Error(`Unexpected module: ${name}`)
  }
  new Function('require', 'module', 'exports', 'window', 'fetch', compiled)(requireMock, compiledModule, compiledModule.exports, window, fetch)
  return compiledModule.exports
}

test('DOC imports extracted Vietnamese text safely and keeps the source name', async () => {
  const file = new File(['test doc'], 'Báo cáo.DOC')
  const { importLocalFile } = load({}, undefined, async (url, options) => {
    assert.equal(url, '/api/files/import-doc')
    assert.equal(options.body, file)
    assert.equal(options.method, 'POST')
    return Response.json({ text: 'Tiếng Việt\r\n<script>alert(1)</script> & chữ' })
  })
  const result = await importLocalFile(file)
  assert.equal(result.name, file.name)
  assert.equal(result.normalized, true)
  assert.equal(result.html, '<p>Tiếng Việt</p><p>&lt;script&gt;alert(1)&lt;/script&gt; &amp; chữ</p>')
})

test('DOC server errors are shown instead of importing empty or missing content', async () => {
  const { importLocalFile } = load({}, undefined, async () => Response.json({ error: 'File có mật khẩu' }, { status: 422 }))
  await assert.rejects(importLocalFile(new File(['doc'], 'test.doc')), /mật khẩu/)
})

test('rejects unsupported, empty and oversized files', async () => {
  const { importLocalFile, LOCAL_FILE_LIMIT } = load()
  await assert.rejects(importLocalFile(new File(['text'], 'old.txt')), /\.docx/)
  await assert.rejects(importLocalFile(new File([], 'empty.docx')), /trống/)
  await assert.rejects(importLocalFile({ name: 'large.docx', size: LOCAL_FILE_LIMIT + 1 }), /20 MB/)
})

test('DOCX parses the original file bytes and applies the administrative template', async () => {
  let buffer
  const { importLocalFile } = load({}, async (input, name) => { buffer = input; return { sourceLayout: true, name } })
  const result = await importLocalFile(new File(['test docx'], 'test.DOCX'))
  assert.ok(buffer instanceof ArrayBuffer)
  assert.deepEqual(result, { sourceLayout: true, name: 'test.DOCX', normalized: true })
})

test('malformed Word errors are surfaced to the user', async () => {
  const { importLocalFile } = load({}, async () => { throw new Error('Invalid ZIP') })
  await assert.rejects(importLocalFile(new File(['broken'], 'broken.docx')), /Không thể nhập file Word.*Invalid ZIP/)
})

test('Save As opens the picker synchronously and provides the Word file type', async () => {
  let options
  const handle = {}
  const file = load({ showSaveFilePicker(value) { options = value; return Promise.resolve(handle) } })
  const result = file.chooseSaveFile('Báo cáo.doc')
  assert.equal(options.suggestedName, 'Báo cáo.docx')
  assert.deepEqual(Object.values(options.types[0].accept), [['.docx']])
  assert.equal(await result, handle)
  assert.equal(load().chooseSaveFile('test'), undefined)
  assert.equal(file.docxFilename('a/b:c?.docx'), 'a_b_c_.docx')
})

test('a successful write closes the file and a failed write aborts it', async () => {
  const { writeSaveFile } = load()
  const calls = []
  const blob = new Blob(['Word'])
  await writeSaveFile({ createWritable: async () => ({ write: async value => { assert.equal(value, blob); calls.push('write') }, close: async () => calls.push('close'), abort: async () => calls.push('abort') }) }, blob)
  assert.deepEqual(calls, ['write', 'close'])
  await assert.rejects(writeSaveFile({ createWritable: async () => ({ write: async () => { throw new Error('Disk full') }, close: async () => calls.push('close'), abort: async () => calls.push('abort') }) }, blob), /Disk full/)
  assert.deepEqual(calls, ['write', 'close', 'abort'])
})
