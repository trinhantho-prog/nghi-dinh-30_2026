/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/app/api/files/import-doc/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
const compiledModule = { exports: {} }
new Function('require', 'module', 'exports', source)(require, compiledModule, compiledModule.exports)
const { POST } = compiledModule.exports
const endpoint = 'http://localhost:3000/api/files/import-doc'
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures/word97-sample.doc'))
const request = (body = fixture, headers = {}) => new Request(endpoint, { method: 'POST', headers: { origin: 'http://localhost:3000', 'content-type': 'application/msword', ...headers }, body })

test('reads a real Word 97–2003 binary document, including Unicode characters', async () => {
  const result = await POST(request())
  assert.equal(result.status, 200)
  const { text } = await result.json()
  assert.match(text, /A second test of reviewing/)
  assert.match(text, /😀 ∀/)
  assert.equal(result.headers.get('cache-control'), 'no-store')
})

test('invalid or renamed text files cannot masquerade as Word DOC', async () => {
  const result = await POST(request(Buffer.from('This is not a Word document')))
  assert.equal(result.status, 400)
  assert.match((await result.json()).error, /không đúng định dạng/)
})

test('corrupt OLE files return an actionable error', async () => {
  const broken = Buffer.alloc(512)
  fixture.subarray(0, 8).copy(broken)
  const result = await POST(request(broken))
  assert.equal(result.status, 422)
  assert.match((await result.json()).error, /Không đọc được/)
})

test('cross-origin uploads and oversized declared requests are rejected', async () => {
  assert.equal((await POST(request(fixture, { origin: 'https://other.example' }))).status, 403)
  assert.equal((await POST(request(fixture, { 'content-length': String(20 * 1024 * 1024 + 1) }))).status, 413)
})

test('streamed data exceeding 20 MB is rejected even without Content-Length', async () => {
  let canceled = false
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(20 * 1024 * 1024 + 1)) }, cancel() { canceled = true } })
  const result = await POST(new Request(endpoint, { method: 'POST', body: stream, duplex: 'half' }))
  assert.equal(result.status, 413)
  assert.equal(canceled, true)
})
