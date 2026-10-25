/* eslint-disable @typescript-eslint/no-require-imports -- This Node CJS harness loads TypeScript without an additional test runner. */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

process.env.GOOGLE_DRIVE_CLIENT_ID = 'test-client'
process.env.GOOGLE_DRIVE_CLIENT_SECRET = 'test-secret'
process.env.GOOGLE_DRIVE_COOKIE_SECRET = 'test-only-encryption-key-with-at-least-32-characters'

const ROOT = path.resolve(__dirname, '..')
const MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const GOOGLE_DOC = 'application/vnd.google-apps.document'
const sampleState = { docType: 'bao-cao', mainContent: 'Nội dung thử nghiệm', mainContentBlocks: [{ type: 'table', rows: [['STT', 'Nội dung']], columnWidths: [20, 80] }] }
const json = value => Response.json(value)

function harness(handler = async () => { throw new Error('Unexpected network request') }) {
  const values = new Map()
  const calls = []
  const cache = new Map()
  const store = { get: name => values.has(name) ? { value: values.get(name) } : undefined, set: (name, value) => values.set(name, value), delete: name => values.delete(name) }
  const fetch = async (url, init) => { calls.push({ url: String(url), init }); return handler(String(url), init) }
  const nextResponse = { redirect: url => {
    const response = new Response(null, { status: 307, headers: { location: String(url) } })
    response.cookieValues = new Map()
    response.cookies = { set: (name, value) => response.cookieValues.set(name, value) }
    return response
  } }
  function load(file) {
    const absolute = path.resolve(ROOT, file)
    if (cache.has(absolute)) return cache.get(absolute).exports
    const compiledModule = { exports: {} }
    cache.set(absolute, compiledModule)
    const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
    function localRequire(name) {
      if (name === 'server-only') return {}
      if (name === 'next/headers') return { cookies: async () => store }
      if (name === 'next/server') return { NextResponse: nextResponse }
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.join(ROOT, 'src', name.slice(2)) : path.resolve(path.dirname(absolute), name)
        return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : path.join(base, 'index.ts'))
      }
      return require(name)
    }
    new Function('require', 'module', 'exports', 'fetch', source)(localRequire, compiledModule, compiledModule.exports, fetch)
    return compiledModule.exports
  }
  const drive = load('src/lib/google-drive.ts')
  const session = { accessToken: 'test-access', refreshToken: 'test-refresh', expiresAt: Date.now() + 3600000, accountId: 'account-A', email: 'test@example.test' }
  values.set(drive.DRIVE_COOKIE, drive.sealDriveSession(session))
  return { load, drive, session, store, values, calls }
}

function saveRequest({ version = '1', accountId = 'account-A', origin = 'http://localhost:3000', state = sampleState } = {}) {
  const form = new FormData()
  form.set('accountId', accountId)
  form.set('version', version)
  form.set('state', JSON.stringify(state))
  form.set('file', new Blob(['test docx content'], { type: MIME }), 'document.docx')
  return new Request('http://localhost:3000/api/drive/file/file-A', { method: 'PUT', headers: { origin }, body: form })
}
const context = { params: Promise.resolve({ id: 'file-A' }) }

test('Drive tokens are encrypted and tampering is rejected', () => {
  const h = harness()
  const sealed = h.drive.sealDriveSession(h.session)
  assert.ok(!sealed.includes('test-access'))
  assert.deepEqual(h.drive.unsealDriveSession(sealed), h.session)
  const changed = `${sealed.slice(0, 40)}${sealed[40] === 'a' ? 'b' : 'a'}${sealed.slice(41)}`
  assert.throws(() => h.drive.unsealDriveSession(changed))
})

test('Expired access token is refreshed only on the server', async () => {
  const h = harness(async url => {
    assert.equal(url, 'https://oauth2.googleapis.com/token')
    return json({ access_token: 'refreshed-access', expires_in: 3600 })
  })
  h.values.set(h.drive.DRIVE_COOKIE, h.drive.sealDriveSession({ ...h.session, expiresAt: 0 }))
  const session = await h.drive.driveSession()
  assert.equal(session.accessToken, 'refreshed-access')
  assert.equal(h.drive.unsealDriveSession(h.values.get(h.drive.DRIVE_COOKIE)).accessToken, 'refreshed-access')
})

test('Folder listing includes empty owned folders and forwards pagination', async () => {
  const h = harness(async url => {
    const params = new URL(url).searchParams
    assert.ok(params.get('q').includes("'me' in owners"))
    assert.ok(params.get('q').includes('application/vnd.google-apps.folder'))
    assert.equal(params.get('pageToken'), 'page-2')
    return json({ files: [{ id: 'empty-folder', name: 'Thư mục trống', mimeType: 'application/vnd.google-apps.folder' }], nextPageToken: 'page-3' })
  })
  const response = await h.load('src/app/api/drive/files/route.ts').GET(new Request('http://localhost:3000/api/drive/files?folders=all&pageToken=page-2'))
  const data = await response.json()
  assert.equal(data.files[0].id, 'empty-folder')
  assert.equal(data.nextPageToken, 'page-3')
})

test('Malformed folder query never reaches Google', async () => {
  const h = harness()
  const response = await h.load('src/app/api/drive/files/route.ts').GET(new Request('http://localhost:3000/api/drive/files?folder=bad%27id'))
  assert.equal(response.status, 400)
  assert.equal(h.calls.length, 0)
})

test('OAuth callback rejects unmatched state before exchanging a code', async () => {
  const h = harness()
  h.values.set(h.drive.DRIVE_STATE_COOKIE, 'expected-state')
  const response = await h.load('src/app/api/drive/callback/route.ts').GET(new Request('http://localhost:3000/api/drive/callback?code=code&state=wrong-state'))
  assert.ok(response.headers.get('location').endsWith('/drive?error=authorization'))
  assert.equal(h.calls.length, 0)
})

test('Cross-origin saves are rejected before any Google request', async () => {
  const h = harness()
  const response = await h.load('src/app/api/drive/file/[id]/route.ts').PUT(saveRequest({ origin: 'https://other.example' }), context)
  assert.equal(response.status, 403)
  assert.equal(h.calls.length, 0)
})

test('Switching accounts cannot save into the previous account file', async () => {
  const h = harness()
  const response = await h.load('src/app/api/drive/file/[id]/route.ts').PUT(saveRequest({ accountId: 'account-B' }), context)
  assert.equal(response.status, 409)
  assert.equal(h.calls.length, 0)
})

test('Remote version conflicts stop upload', async () => {
  const h = harness(async () => json({ id: 'file-A', version: '2', mimeType: MIME, capabilities: { canEdit: true } }))
  const response = await h.load('src/app/api/drive/file/[id]/route.ts').PUT(saveRequest(), context)
  assert.equal(response.status, 409)
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].init.method, undefined)
})

test('Read-only source cannot be overwritten', async () => {
  const h = harness(async () => json({ id: 'file-A', version: '1', mimeType: MIME, capabilities: { canEdit: false } }))
  const response = await h.load('src/app/api/drive/file/[id]/route.ts').PUT(saveRequest(), context)
  assert.equal(response.status, 403)
  assert.equal(h.calls.length, 1)
})

test('Saving updates the same file, keeps Google Docs type, and saves hidden editor state', async () => {
  const h = harness(async (url, init) => {
    if (url.includes('/upload/') && init.method === 'PATCH') {
      assert.ok(url.includes('/files/file-A?'))
      assert.equal(init.headers['if-match'], 'revision-tag')
      const body = await init.body.text()
      assert.ok(body.includes(`"mimeType":"${GOOGLE_DOC}"`))
      assert.ok(!body.includes('"parents"'))
      return json({ id: 'file-A', mimeType: GOOGLE_DOC, version: '2', modifiedTime: '2026-10-24T00:00:00Z' })
    }
    if (url.includes('/upload/') && init.method === 'POST') {
      assert.ok(init.body.includes('appDataFolder'))
      assert.ok(init.body.includes('"columnWidths":[20,80]'))
      assert.ok(init.body.includes('"version":"2"'))
      return json({ id: 'hidden-snapshot' })
    }
    if (new URL(url).searchParams.get('spaces') === 'appDataFolder') return json({ files: [] })
    return new Response(JSON.stringify({ id: 'file-A', version: '1', mimeType: GOOGLE_DOC, capabilities: { canEdit: true } }), { headers: { 'content-type': 'application/json', etag: 'revision-tag' } })
  })
  const response = await h.load('src/app/api/drive/file/[id]/route.ts').PUT(saveRequest(), context)
  assert.equal(response.status, 200)
  assert.equal((await response.json()).version, '2')
  assert.equal(h.calls.length, 4)
})

test('Reopening matching editor snapshot restores full structured tables', async () => {
  const h = harness(async url => {
    if (url.includes('alt=media')) return json({ version: '7', state: sampleState })
    if (new URL(url).searchParams.get('spaces') === 'appDataFolder') return json({ files: [{ id: 'snapshot-id' }] })
    return json({ id: 'file-A', name: 'File.docx', version: '7', mimeType: MIME, capabilities: { canEdit: true } })
  })
  const response = await h.load('src/app/api/drive/file/[id]/route.ts').GET(new Request('http://localhost:3000/api/drive/file/file-A'), context)
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.source.accountId, 'account-A')
  assert.deepEqual(data.state.mainContentBlocks[0].columnWidths, [20, 80])
  assert.ok(!data.html)
})

test('Invalid table state is rejected instead of corrupting saved files', () => {
  const h = harness()
  const validate = h.load('src/lib/drive-document.ts').validateDriveDocument
  assert.throws(() => validate({ mainContentBlocks: [{ type: 'table', rows: [['a'], ['b', 'c']] }] }))
  assert.throws(() => validate({ mainContentBlocks: [{ type: 'unexpected' }] }))
  assert.equal(validate({ docType: 'not-a-type' }).docType, 'cong-van')
})

test('Recognize the report header shown in the Drive import regression', () => {
  const h = harness()
  const { recognizeImportedDocument } = h.load('src/lib/recognize-document.ts')
  const bodyTable = { type: 'table', rows: [['STT', 'Chi phí'], ['1', '1.000.000']] }
  const state = recognizeImportedDocument([
    { type: 'table', rows: [
      ['BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP\nBẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc'],
      ['', 'Cao Lãnh, ngày ... tháng 10 năm 2026'],
    ] },
    { type: 'paragraph', text: 'BÁO CÁO.' },
    { type: 'paragraph', text: 'ĐÁNH GIÁ TÌNH HÌNH CHI PHÍ KHÁM, CHỮA BỆNH BHYT 8 THÁNG ĐẦU NĂM 2026' },
    { type: 'paragraph', text: 'I. KẾT QUẢ THỰC HIỆN' },
    { type: 'paragraph', text: 'Nội dung báo cáo được giữ nguyên.' }, bodyTable,
  ], '87044 - noi dung lam viec voi BVQDY_OK.docx')
  assert.equal(state.agencyUpper, 'BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP')
  assert.equal(state.agencyMain, 'BẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH')
  assert.equal(state.location, 'Cao Lãnh')
  assert.equal(state.date, '')
  assert.equal(state.dateText, 'ngày ... tháng 10 năm 2026')
  assert.equal(state.docType, 'bao-cao')
  assert.ok(state.docSummary.startsWith('ĐÁNH GIÁ TÌNH HÌNH'))
  assert.ok(!state.mainContent.includes('CỘNG HÒA'))
  assert.ok(!state.mainContent.includes('BẢO HIỂM XÃ HỘI'))
  assert.equal(state.mainContentBlocks[0].text, 'I. KẾT QUẢ THỰC HIỆN')
  assert.deepEqual(state.mainContentBlocks.at(-1), bodyTable)
})

test('Recognize number, symbol, complete date, and cong van summary', () => {
  const h = harness()
  const { recognizeImportedDocument } = h.load('src/lib/recognize-document.ts')
  const state = recognizeImportedDocument([
    { type: 'table', rows: [['CƠ QUAN CHỦ QUẢN\nCƠ QUAN BAN HÀNH', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc'], ['Số: 123/BHXH-VP\nV/v phối hợp thực hiện nhiệm vụ', 'Cao Lãnh, ngày 24 tháng 10 năm 2026']] },
    { type: 'paragraph', text: 'Kính gửi: Bệnh viện Quân dân y' },
    { type: 'paragraph', text: 'Đề nghị các đơn vị phối hợp thực hiện.' },
  ], 'file.docx')
  assert.equal(state.docNumber, '123')
  assert.equal(state.docSymbol, 'BHXH-VP')
  assert.equal(state.date, '2026-10-24')
  assert.equal(state.docSummary, 'phối hợp thực hiện nhiệm vụ')
  assert.equal(state.recipient, 'Bệnh viện Quân dân y')
  assert.equal(state.mainContent, 'Đề nghị các đơn vị phối hợp thực hiện.')
})

test('Minutes recognize sentence-case descriptions and include the following number in the summary', () => {
  const { recognizeImportedDocument, repairImportedDocument } = harness().load('src/lib/recognize-document.ts')
  const description = 'xác định số vượt dự kiến chi khám chữa bệnh được quỹ Bảo hiểm y tế thanh toán năm 2024 của Trung tâm Y tế khu vực Cao Lãnh 2, (Mã cơ sở KCB: 87003)'
  const blocks = ['BIÊN BẢN', description, 'Số: 01_2024/BB', 'Hôm nay, chúng tôi tiến hành làm việc.', 'I. NỘI DUNG', 'Giữ nguyên nội dung biên bản.'].map(text => ({ type: 'paragraph', text }))
  const state = recognizeImportedDocument(blocks, '87003.docx')
  assert.equal(state.docType, 'bien-ban')
  assert.equal(state.docSummary, `${description}\nSố: 01_2024/BB`)
  assert.equal(state.docNumber, '01_2024')
  assert.equal(state.docSymbol, 'BB')
  assert.deepEqual(state.mainContentBlocks, blocks.slice(3))
  const repaired = repairImportedDocument({ ...state, docType: 'cong-van', docSummary: '87003', mainContentBlocks: blocks })
  assert.equal(repaired.docType, 'bien-ban')
  assert.equal(repaired.docSummary, state.docSummary)
  assert.deepEqual(repairImportedDocument(repaired), repaired)
})

test('Minutes keep opening body text out of the summary even if a number appears later', () => {
  const { recognizeImportedDocument } = harness().load('src/lib/recognize-document.ts')
  const body = ['Hôm nay, chúng tôi tiến hành làm việc.', 'Số: 01/BB', 'Nội dung thảo luận.'].map(text => ({ type: 'paragraph', text }))
  const state = recognizeImportedDocument([{ type: 'paragraph', text: 'BIÊN BẢN' }, ...body], 'Minutes.docx')
  assert.equal(state.docType, 'bien-ban')
  assert.equal(state.docSummary, '')
  assert.deepEqual(state.mainContentBlocks, body)
})

test('Recognize plain paragraph headers and keep Roman body headings', () => {
  const h = harness()
  const { recognizeImportedDocument } = h.load('src/lib/recognize-document.ts')
  const lines = ['ỦY BAN NHÂN DÂN TỈNH ĐỒNG THÁP', 'SỞ Y TẾ', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', 'Số: 45/KH-SYT', 'Cao Lãnh, ngày 24 tháng 10 năm 2026', 'KẾ HOẠCH', 'THỰC HIỆN NHIỆM VỤ NĂM 2026', 'I. MỤC ĐÍCH', 'Triển khai các nhiệm vụ.']
  const state = recognizeImportedDocument(lines.map(text => ({ type: 'paragraph', text })), 'kehoach.docx')
  assert.equal(state.agencyMain, 'SỞ Y TẾ')
  assert.equal(state.docType, 'ke-hoach')
  assert.equal(state.docSummary, 'THỰC HIỆN NHIỆM VỤ NĂM 2026')
  assert.ok(state.mainContent.startsWith('I. MỤC ĐÍCH'))
})

test('Repair older glued headers without replacing body or conclusion', () => {
  const h = harness()
  const { repairImportedDocument } = h.load('src/lib/recognize-document.ts')
  const state = repairImportedDocument({ ...sampleState, agencyMain: 'CƠ QUAN MẶC ĐỊNH SAI', conclusion: 'Giữ kết luận này', mainContentBlocks: [
    { type: 'table', rows: [['BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁPBẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH', 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAMĐộc lập - Tự do - Hạnh phúc']] },
    { type: 'paragraph', text: 'BÁO CÁO' }, { type: 'paragraph', text: 'TỔNG KẾT NĂM 2026' }, { type: 'paragraph', text: 'Nội dung gốc.' },
  ] })
  assert.equal(state.agencyMain, 'BẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH')
  assert.equal(state.mainContent, 'Nội dung gốc.')
  assert.equal(state.conclusion, 'Giữ kết luận này')
})

test('Ordinary content tables are never mistaken for document headers', () => {
  const h = harness()
  const { recognizeImportedDocument, repairImportedDocument } = h.load('src/lib/recognize-document.ts')
  const blocks = [{ type: 'table', rows: [['STT', 'Nội dung'], ['1', 'BÁO CÁO']] }, { type: 'paragraph', text: 'Nội dung thông thường' }]
  assert.deepEqual(recognizeImportedDocument(blocks, 'Ghi chú.docx').mainContentBlocks, blocks)
  const state = { ...sampleState, mainContentBlocks: blocks }
  assert.equal(repairImportedDocument(state), state)
})

test('Bold mixed-case summary is recognized without consuming the body', () => {
  const h = harness()
  const { recognizeImportedDocument } = h.load('src/lib/recognize-document.ts')
  const summary = 'Kết quả thực hiện nhiệm vụ tháng 10'
  const state = recognizeImportedDocument([{ type: 'paragraph', text: 'BÁO CÁO' }, { type: 'paragraph', text: summary }, { type: 'paragraph', text: 'Căn cứ kế hoạch đã được phê duyệt.' }], 'report.docx', new Set([summary]))
  assert.equal(state.docSummary, summary)
  assert.equal(state.mainContent, 'Căn cứ kế hoạch đã được phê duyệt.')
})

test('Excel TSV keeps quoted newlines, quotes, blank cells, and trailing rows', () => {
  const h = harness()
  const { parseTabularText } = h.load('src/components/document-editor/mainContentBlocks.ts')
  assert.deepEqual(parseTabularText('STT\tNội dung\tGhi chú\r\n1\t"Dòng 1\nDòng 2 có ""ngoặc kép"""\t\r\n\t\t\r\n'), [
    ['STT', 'Nội dung', 'Ghi chú'], ['1', 'Dòng 1\nDòng 2 có "ngoặc kép"', ''], ['', '', ''],
  ])
  assert.equal(parseTabularText('Đoạn 1\nĐoạn 2'), null)
  assert.deepEqual(parseTabularText('Một\nHai\n', true), [['Một'], ['Hai']])
})

test('Uppercase body sections with dash separators remain in the body', () => {
  const h = harness()
  const { recognizeImportedDocument } = h.load('src/lib/recognize-document.ts')
  const state = recognizeImportedDocument(['BÁO CÁO', 'TỔNG KẾT NHIỆM VỤ', 'I - TÌNH HÌNH CHUNG', 'Nội dung.'].map(text => ({ type: 'paragraph', text })), 'report.docx')
  assert.equal(state.docSummary, 'TỔNG KẾT NHIỆM VỤ')
  assert.ok(state.mainContent.startsWith('I - TÌNH HÌNH CHUNG'))
})

test('Import the three-column footer in the screenshot without duplicating it', () => {
  const h = harness()
  const { recognizeImportedDocument } = h.load('src/lib/recognize-document.ts')
  const state = recognizeImportedDocument([
    { type: 'paragraph', text: 'BÁO CÁO' }, { type: 'paragraph', text: 'KẾT QUẢ THỰC HIỆN' },
    { type: 'paragraph', text: 'I. NỘI DUNG' }, { type: 'paragraph', text: 'Số liệu báo cáo được giữ nguyên.' },
    { type: 'paragraph', text: 'Trên đây là báo cáo kết quả thực hiện nhiệm vụ./.' },
    { type: 'table', rows: [['Nơi nhận:', '', 'GIÁM ĐỐC'], ['- Như trên;\n- Giám đốc BHXH cơ\nsở;\n- Các PGĐ BHXH cơ sở;\n- Lưu: VT, CĐBHYT.', '', 'Đoàn Văn Đông']] },
  ], 'report.docx')
  assert.equal(state.signPosition, 'GIÁM ĐỐC')
  assert.equal(state.signName, 'Đoàn Văn Đông')
  assert.equal(state.signAuthority, '')
  assert.equal(state.recipientsCc, '- Như trên;\n- Giám đốc BHXH cơ sở;\n- Các PGĐ BHXH cơ sở;\n- Lưu: VT, CĐBHYT.')
  assert.equal(state.conclusion, 'Trên đây là báo cáo kết quả thực hiện nhiệm vụ./.')
  assert.equal(state.mainContent, 'I. NỘI DUNG\nSố liệu báo cáo được giữ nguyên.')
  assert.ok(!state.mainContent.includes('Đoàn Văn Đông'))
})

test('Repair a footer in an older Drive snapshot even when the header is already clean', () => {
  const h = harness()
  const { repairImportedDocument } = h.load('src/lib/recognize-document.ts')
  const state = repairImportedDocument({ ...sampleState, signName: 'Tên mặc định sai', recipientsCc: '- Lưu: VT.', mainContentBlocks: [
    { type: 'paragraph', text: 'Giữ đoạn nội dung này.' },
    { type: 'table', rows: [['Nơi nhận:\n- Phòng nghiệp vụ;\n- Lưu: VT.', '', 'GIÁM ĐỐCĐoàn Văn Đông']] },
  ] })
  assert.equal(state.signName, 'Đoàn Văn Đông')
  assert.equal(state.mainContent, 'Giữ đoạn nội dung này.')
  assert.ok(state.recipientsCc.includes('Phòng nghiệp vụ'))
  assert.deepEqual(repairImportedDocument(state), state)
})

test('Keep explicit TM and KT lines and ignore the signed stamp when finding the name', () => {
  const h = harness()
  const { extractDocumentFooter } = h.load('src/lib/recognize-document-footer.ts')
  const result = extractDocumentFooter([{ type: 'table', rows: [['Nơi nhận:\n- Lưu: VT.', 'TM. ỦY BAN NHÂN DÂN\nKT. CHỦ TỊCH\nPHÓ CHỦ TỊCH\nĐÃ KÝ\nNGUYỄN VĂN AN']] }])
  assert.equal(result.fields.signAuthority, 'TM. ỦY BAN NHÂN DÂN\nKT. CHỦ TỊCH')
  assert.equal(result.fields.signPosition, 'PHÓ CHỦ TỊCH')
  assert.equal(result.fields.signName, 'NGUYỄN VĂN AN')
  assert.deepEqual(result.blocks, [])
})

test('Recognize paragraph footers and preserve unrelated preceding text', () => {
  const h = harness()
  const { extractDocumentFooter } = h.load('src/lib/recognize-document-footer.ts')
  const result = extractDocumentFooter(['GIÁM ĐỐC', 'Đây là nội dung trao đổi về trách nhiệm của giám đốc.', 'Nơi nhận:', '- Như trên;', '- Lưu: VT.', 'KT.', 'GIÁM ĐỐC', 'PHÓ GIÁM ĐỐC', '(Đã ký)', 'Nguyễn Văn An'].map(text => ({ type: 'paragraph', text })))
  assert.equal(result.fields.signName, 'Nguyễn Văn An')
  assert.equal(result.fields.signPosition, 'PHÓ GIÁM ĐỐC')
  assert.equal(result.fields.signAuthority, 'KT. GIÁM ĐỐC')
  assert.equal(result.blocks.length, 2)
  assert.ok(result.blocks[1].text.includes('nội dung trao đổi'))
})

test('Do not remove body data tables that list staff roles and names', () => {
  const h = harness()
  const { extractDocumentFooter } = h.load('src/lib/recognize-document-footer.ts')
  const table = { type: 'table', rows: [['STT', 'Chức vụ', 'Họ tên'], ['1', 'GIÁM ĐỐC', 'Đoàn Văn Đông']] }
  const result = extractDocumentFooter([table])
  assert.deepEqual(result.blocks, [table])
  assert.deepEqual(result.fields, {})
})

test('Explicit conclusion section moves its text and keeps the section heading', () => {
  const h = harness()
  const { extractDocumentFooter } = h.load('src/lib/recognize-document-footer.ts')
  const result = extractDocumentFooter(['Giữ nội dung trước kết luận.', 'III. KẾT LUẬN', 'Công tác triển khai đạt yêu cầu.', 'Các đơn vị tiếp tục thực hiện nhiệm vụ.'].map(text => ({ type: 'paragraph', text })))
  assert.equal(result.fields.conclusion, 'Công tác triển khai đạt yêu cầu.\nCác đơn vị tiếp tục thực hiện nhiệm vụ.')
  assert.equal(result.blocks.at(-1).text, 'III. KẾT LUẬN')
})

test('Signature authority does not mistake BAO HIEM XA HOI for a collective council', () => {
  const h = harness()
  const { signatureAuthorityLines } = h.load('src/lib/document-signature.ts')
  assert.deepEqual(signatureAuthorityLines({ agencyUpper: 'BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP', signPosition: 'GIÁM ĐỐC' }), [])
  assert.deepEqual(signatureAuthorityLines({ agencyUpper: 'ỦY BAN NHÂN DÂN', signPosition: 'PHÓ CHỦ TỊCH' }), ['TM. ỦY BAN NHÂN DÂN', 'KT. CHỦ TỊCH'])
  assert.deepEqual(signatureAuthorityLines({ agencyUpper: 'ỦY BAN NHÂN DÂN', signPosition: 'PHÓ CHỦ TỊCH', signAuthority: '' }), [])
  assert.deepEqual(signatureAuthorityLines({ agencyUpper: '', signPosition: '', signAuthority: 'TL. GIÁM ĐỐC' }), ['TL. GIÁM ĐỐC'])
})

test('A structured snapshot keeps an existing conclusion when there is no raw signature footer', () => {
  const h = harness()
  const { repairImportedDocument } = h.load('src/lib/recognize-document.ts')
  const state = { ...sampleState, conclusion: 'Kết luận người dùng đã sửa.', mainContentBlocks: [{ type: 'paragraph', text: 'Nội dung chính kết thúc./.' }] }
  assert.equal(repairImportedDocument(state), state)
})

test('DOCX export contains one recipients section and one signer after footer recognition', async () => {
  const h = harness()
  const { recognizeImportedDocument } = h.load('src/lib/recognize-document.ts')
  const { createDocxBlob } = h.load('src/components/document-editor/exportDocx.ts')
  const state = recognizeImportedDocument([
    { type: 'paragraph', text: 'Nội dung chính.' },
    { type: 'paragraph', text: 'Trên đây là nội dung báo cáo./.' },
    { type: 'table', rows: [['Nơi nhận:\n- Như trên;\n- Lưu: VT, CĐBHYT.', '', 'GIÁM ĐỐC\nĐoàn Văn Đông']] },
  ], 'file.docx')
  state.agencyUpper = 'BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP'
  const blob = await createDocxBlob(state)
  const { value } = await require('mammoth').extractRawText({ buffer: Buffer.from(await blob.arrayBuffer()) })
  assert.equal((value.match(/Nơi nhận:/g) || []).length, 1)
  assert.equal((value.match(/Đoàn Văn Đông/g) || []).length, 1)
  assert.ok(!value.includes('TM. BẢO HIỂM'))
  assert.ok(value.includes('Trên đây là nội dung báo cáo./.'))
  assert.ok(value.includes('CĐBHYT'))
})

test('Recover a file already saved with an extra generated footer after its original signer', () => {
  const h = harness()
  const { extractDocumentFooter } = h.load('src/lib/recognize-document-footer.ts')
  const result = extractDocumentFooter([
    { type: 'paragraph', text: 'Nội dung chính.' },
    { type: 'table', rows: [['Nơi nhận:\n- Như trên;\n- Lưu: VT, CĐBHYT.', '', 'GIÁM ĐỐC\nĐoàn Văn Đông']] },
    { type: 'table', rows: [['Nơi nhận:\n- Như trên;\n- Lưu: VT.', 'TM. BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP\nGIÁM ĐỐC']] },
  ])
  assert.equal(result.fields.signName, 'Đoàn Văn Đông')
  assert.equal(result.fields.signAuthority, '')
  assert.ok(result.fields.recipientsCc.includes('CĐBHYT'))
  assert.deepEqual(result.blocks, [{ type: 'paragraph', text: 'Nội dung chính.' }])
})

test('Excel grouped headers retain horizontal and vertical merge geometry through Drive state validation', () => {
  const h = harness()
  const { EXCEL_KCB_TABLE } = h.load('tests/fixtures/excel-kcb.ts')
  const { validateDriveDocument } = h.load('src/lib/drive-document.ts')
  const { tableCellLayout, visibleTableCells } = h.load('src/lib/table-layout.ts')
  const table = validateDriveDocument(JSON.parse(JSON.stringify({ ...sampleState, mainContentBlocks: [EXCEL_KCB_TABLE] }))).mainContentBlocks[0]
  assert.equal(table.merges.length, 12)
  assert.equal(tableCellLayout(table, 0, 1).colSpan, 4)
  assert.equal(tableCellLayout(table, 0, 0).rowSpan, 3)
  assert.equal(tableCellLayout(table, 1, 0).hidden, true)
  assert.equal(tableCellLayout(table, 2, 3).hidden, false)
  assert.equal(visibleTableCells(table).length, 38)
  assert.equal(table.cellStyles[0][1].background, '#E7E6E6')
  assert.equal(table.fontSize, 10)
  assert.equal(table.sourceWidth, 726)
  assert.ok(table.columnWidths[0] > table.columnWidths[1])
})

test('Insert and delete columns or rows without destroying imported merged header labels', () => {
  const h = harness()
  const { EXCEL_KCB_TABLE } = h.load('tests/fixtures/excel-kcb.ts')
  const { changeTableStructure, validateTableLayout } = h.load('src/lib/table-layout.ts')
  const inserted = changeTableStructure(EXCEL_KCB_TABLE, 'row', 1, false)
  assert.equal(inserted.merges[0].rowSpan, 4)
  assert.equal(inserted.rows[2][1], '08T2025')
  validateTableLayout(inserted)
  const removed = changeTableStructure(EXCEL_KCB_TABLE, 'column', 1, true)
  assert.equal(removed.rows[0][1], 'Lượt KCB tại CSKCB')
  assert.equal(removed.merges.find(merge => merge.row === 0 && merge.column === 1).colSpan, 3)
  assert.equal(removed.cellStyles[0][1].bold, true)
  validateTableLayout(removed)
})

test('Pasting over an existing table restores the full Excel layout and formats', () => {
  const h = harness()
  const { EXCEL_KCB_TABLE } = h.load('tests/fixtures/excel-kcb.ts')
  const { pasteTableInto, validateTableLayout } = h.load('src/lib/table-layout.ts')
  const target = { type: 'table', rows: EXCEL_KCB_TABLE.rows.map(row => row.map(() => 'cũ')) }
  const replaced = pasteTableInto(target, EXCEL_KCB_TABLE, 0, 0)
  assert.deepEqual(replaced.merges, EXCEL_KCB_TABLE.merges)
  assert.deepEqual(replaced.columnWidths, EXCEL_KCB_TABLE.columnWidths)
  assert.equal(replaced.sourceWidth, 726)
  assert.equal(replaced.rows[4][1], '131,450')
  validateTableLayout(replaced)
})

test('Reject overlapping merges and merges that would hide existing data', () => {
  const h = harness()
  const { validateTableLayout } = h.load('src/lib/table-layout.ts')
  assert.throws(() => validateTableLayout({ type: 'table', rows: [['a', 'important']], merges: [{ row: 0, column: 0, rowSpan: 1, colSpan: 2 }] }))
  assert.throws(() => validateTableLayout({ type: 'table', rows: [['a', '', '']], merges: [{ row: 0, column: 0, rowSpan: 1, colSpan: 2 }, { row: 0, column: 1, rowSpan: 1, colSpan: 2 }] }))
})

test('DOCX keeps the Excel merge grid, header shading, and scaled font sizes', async () => {
  const h = harness()
  const { EXCEL_KCB_TABLE } = h.load('tests/fixtures/excel-kcb.ts')
  const { DEFAULT_DOCUMENT_STATE } = h.load('src/types/index.ts')
  const { createDocxBlob } = h.load('src/components/document-editor/exportDocx.ts')
  const blob = await createDocxBlob({ ...DEFAULT_DOCUMENT_STATE, mainContentBlocks: [EXCEL_KCB_TABLE] })
  const JSZip = require(require.resolve('jszip', { paths: [path.dirname(require.resolve('docx'))] }))
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml').async('string')
  assert.equal((xml.match(/<w:gridSpan w:val="4"\/>/g) || []).length, 2)
  assert.equal((xml.match(/<w:vMerge w:val="restart"\/>/g) || []).length, 7)
  assert.equal((xml.match(/<w:vMerge w:val="continue"\/>/g) || []).length, 8)
  assert.ok(xml.includes('w:fill="E7E6E6"'))
  assert.ok(xml.includes('<w:sz w:val="17"/>'))
  assert.ok(xml.includes('131,450'))
})

test('Merging a rectangular selection keeps all cell text in reading order', () => {
  const h = harness()
  const { mergeTableCells, unmergeTableCells, validateTableLayout } = h.load('src/lib/table-layout.ts')
  const block = { type: 'table', rows: [['A', 'B', 'C'], ['D', 'E', 'F']], columnWidths: [20, 30, 50] }
  const merged = mergeTableCells(block, { top: 0, left: 0, bottom: 1, right: 1 })
  assert.equal(merged.rows[0][0], 'A\nB\nD\nE')
  assert.equal(merged.rows[1][1], '')
  assert.equal(merged.rows[1][2], 'F')
  assert.deepEqual(merged.merges, [{ row: 0, column: 0, rowSpan: 2, colSpan: 2 }])
  assert.deepEqual(merged.columnWidths, block.columnWidths)
  validateTableLayout(merged)
  const split = unmergeTableCells(merged, { top: 0, left: 0, bottom: 1, right: 1 })
  assert.deepEqual(split.merges, [])
  assert.equal(split.rows[0][0], 'A\nB\nD\nE')
})

test('Selecting part of an imported merged cell expands to a complete valid rectangle', () => {
  const h = harness()
  const { EXCEL_KCB_TABLE } = h.load('tests/fixtures/excel-kcb.ts')
  const { expandCellRange, mergeTableCells, validateTableLayout } = h.load('src/lib/table-layout.ts')
  const range = expandCellRange(EXCEL_KCB_TABLE, { top: 0, left: 2, bottom: 1, right: 3 })
  assert.deepEqual(range, { top: 0, left: 1, bottom: 2, right: 4 })
  const merged = mergeTableCells(EXCEL_KCB_TABLE, range)
  assert.ok(merged.rows[0][1].includes('Lượt KCB tại CSKCB'))
  assert.ok(merged.rows[0][1].includes('08T2025'))
  validateTableLayout(merged)
})

const PNG_DATA = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aE6sAAAAASUVORK5CYII='

test('Screenshot image blocks survive Drive validation and administrative recognition', () => {
  const h = harness()
  const { validateDriveDocument } = h.load('src/lib/drive-document.ts')
  const { repairImportedDocument, recognizeImportedDocument } = h.load('src/lib/recognize-document.ts')
  const image = { type: 'image', src: PNG_DATA, width: 640, height: 240, widthPercent: 80, align: 'right', alt: 'Ảnh kiểm tra' }
  const state = validateDriveDocument({ ...sampleState, mainContentBlocks: [image] })
  assert.equal(state.mainContentBlocks[0].src, PNG_DATA)
  assert.equal(state.mainContentBlocks[0].widthPercent, 80)
  assert.equal(repairImportedDocument(state), state)
  assert.deepEqual(recognizeImportedDocument([image], 'file.docx').mainContentBlocks, [image])
  assert.throws(() => validateDriveDocument({ mainContentBlocks: [{ ...image, src: 'https://example.test/remote.png' }] }))
  assert.throws(() => validateDriveDocument({ mainContentBlocks: [{ ...image, src: 'data:image/svg+xml;base64,PHN2Zz4=' }] }))
})

test('Screenshot sizing preserves aspect ratio within the Word page', () => {
  const h = harness()
  const { documentImageSize } = h.load('src/lib/document-image.ts')
  assert.deepEqual(documentImageSize({ width: 1600, height: 800, widthPercent: 50 }, 624), { width: 312, height: 156 })
  const tall = documentImageSize({ width: 500, height: 3000, widthPercent: 100 }, 624)
  assert.equal(tall.height, 820)
  assert.ok(Math.abs(tall.width / tall.height - 1 / 6) < .0001)
})

test('DOCX embeds screenshot bytes rather than a remote link', async () => {
  const h = harness()
  const { DEFAULT_DOCUMENT_STATE } = h.load('src/types/index.ts')
  const { createDocxBlob } = h.load('src/components/document-editor/exportDocx.ts')
  const blob = await createDocxBlob({ ...DEFAULT_DOCUMENT_STATE, mainContentBlocks: [{ type: 'image', src: PNG_DATA, width: 640, height: 240, widthPercent: 75, align: 'center', alt: 'Ảnh kiểm tra' }] })
  const JSZip = require(require.resolve('jszip', { paths: [path.dirname(require.resolve('docx'))] }))
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const media = Object.keys(zip.files).filter(name => name.startsWith('word/media/') && name.endsWith('.png'))
  assert.equal(media.length, 1)
  assert.ok((await zip.file(media[0]).async('uint8array')).length > 0)
  const xml = await zip.file('word/document.xml').async('string')
  assert.ok(xml.includes('<w:drawing>'))
})

for (const mimeType of [MIME, GOOGLE_DOC]) test(`Opening ${mimeType} imports embedded screenshots in reading order`, async () => {
  const h = harness(async url => {
    if (new URL(url).searchParams.get('spaces') === 'appDataFolder') return json({ files: [] })
    if (url.includes('alt=media') || url.includes('/export?')) return new Response(await blob.arrayBuffer())
    return json({ id: 'file-A', name: 'Anh.docx', version: '8', mimeType, capabilities: { canEdit: true } })
  })
  const { DEFAULT_DOCUMENT_STATE } = h.load('src/types/index.ts')
  const { createDocxBlob } = h.load('src/components/document-editor/exportDocx.ts')
  const image = { type: 'image', src: PNG_DATA, width: 640, height: 240, widthPercent: 100, align: 'center', alt: 'Ảnh bước 1' }
  const blob = await createDocxBlob({ ...DEFAULT_DOCUMENT_STATE, mainContentBlocks: [{ type: 'paragraph', text: 'Trước ảnh' }, image, { type: 'paragraph', text: 'Sau ảnh' }, { ...image, alt: 'Ảnh bước 2' }] })
  const response = await h.load('src/app/api/drive/file/[id]/route.ts').GET(new Request('http://localhost:3000/api/drive/file/file-A'), context)
  const data = await response.json()
  assert.equal(response.status, 200)
  const original = Buffer.from(await blob.arrayBuffer())
  assert.deepEqual(Buffer.from(data.docx, 'base64'), original)
  const zip = await require('jszip').loadAsync(Buffer.from(data.docx, 'base64'))
  const xml = await zip.file('word/document.xml').async('string')
  assert.ok(xml.indexOf('Trước ảnh') < xml.indexOf('w:drawing'))
  assert.ok(xml.indexOf('w:drawing') < xml.indexOf('Sau ảnh'))
  assert.ok(Object.keys(zip.files).some(name => name.startsWith('word/media/')))
})

test('Pasting subsequent screenshots inherits the preceding image layout regardless of pixel width', () => {
  const { matchPreviousImageLayout, documentImageSize } = harness().load('src/lib/document-image.ts')
  const image = { type: 'image', src: PNG_DATA, width: 1200, height: 400, widthPercent: 80, align: 'left', alt: 'A' }
  const blocks = [image, { type: 'paragraph', text: 'Giữa hai ảnh' }]
  const next = matchPreviousImageLayout([{ ...image, width: 600, height: 200, widthPercent: 50, align: 'center' }], blocks, 1)[0]
  assert.equal(next.align, 'left')
  assert.equal(next.widthPercent, 80)
  assert.equal(documentImageSize(next, 624).width, documentImageSize(image, 624).width)
  assert.equal(matchPreviousImageLayout([image], [], 0)[0].widthPercent, 100)
})
