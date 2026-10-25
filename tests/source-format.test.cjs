/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const JSZip = require('jszip')
const { JSDOM } = require('jsdom')
const dom = new JSDOM('')
function harness(decodeImage, reactOverride) {
  const cache = new Map()
  function load(file) {
    const absolute = path.resolve(__dirname, '..', file)
    if (cache.has(absolute)) return cache.get(absolute).exports
    const compiledModule = { exports: {} }
    cache.set(absolute, compiledModule)
    const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    const localRequire = name => {
      if (name === 'react' && reactOverride) return reactOverride
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? path.resolve(__dirname, '../src', name.slice(2)) : path.resolve(path.dirname(absolute), name)
        if (base.endsWith(`${path.sep}document-image`) && decodeImage) return { ...load(`${base}.ts`), clipboardImageBlock: decodeImage }
        return load(fs.existsSync(`${base}.ts`) ? `${base}.ts` : fs.existsSync(`${base}.tsx`) ? `${base}.tsx` : path.join(base, 'index.ts'))
      }
      return require(name)
    }
    new Function('require', 'module', 'exports', 'DOMParser', source)(localRequire, compiledModule, compiledModule.exports, dom.window.DOMParser)
    return compiledModule.exports
  }
  return { load }
}
const p = (text, size = 26, props = '', run = '') => `<w:p><w:pPr>${props}</w:pPr><w:r><w:rPr><w:sz w:val="${size}"/>${run}</w:rPr><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`
const cell = (text, span = 1, merge = '') => `<w:tc><w:tcPr><w:gridSpan w:val="${span}"/>${merge}</w:tcPr>${p(text, 18, '<w:jc w:val="center"/>', '<w:b/>')}</w:tc>`
async function fixture() {
  const zip = new JSZip()
  const header = `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="nil"/><w:bottom w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr><w:tc>${p('BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP')}${p('BẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH',26,'','<w:b/>')}${p('V/v cảnh báo chi phí KCB BHYT',24)}${p('tăng cao 9 tháng đầu năm 2026',24)}</w:tc><w:tc>${p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',26,'','<w:b/>')}</w:tc></w:tr></w:tbl>`
  const table = `<w:tbl><w:tblPr><w:tblBorders><w:top w:val="single"/><w:bottom w:val="single"/><w:insideH w:val="single"/></w:tblBorders></w:tblPr><w:tblGrid>${[2200,1400,1300,1300,2800].map(w => `<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid><w:tr>${cell('Tên CSKCB',1,'<w:vMerge w:val="restart"/>')}${cell('Tại CSKCB',2)}${cell('CPBQ tại CSKCB',2)}</w:tr><w:tr>${cell('',1,'<w:vMerge/>')}${cell('Số lượt KCB')}${cell('Tổng chi BHYT')}${cell('09T2025')}${cell('09T2026')}</w:tr><w:tr>${cell('Ttyt Khu Vực Cao Lãnh 2')}${cell('91.244')}${cell('19,90')}${cell('183.108')}${cell('218.141')}</w:tr></w:tbl>`
  zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${header}${p('Kính gửi: Trung tâm Y tế Khu vực Cao Lãnh 2.',26,'<w:jc w:val="center"/><w:spacing w:before="240" w:after="120" w:line="300" w:lineRule="auto"/>')}${p('Thực hiện quy định tại Điều 13 Thông tư số 12/2026/TT-BTC.',26,'<w:jc w:val="both"/><w:ind w:firstLine="720"/><w:spacing w:before="0" w:after="120" w:line="280" w:lineRule="exact"/>')}${p('Đơn vị tính: tỷ đồng',22,'<w:jc w:val="right"/>')}${table}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:bottom="1134" w:left="1440" w:right="720"/></w:sectPr></w:body></w:document>`)
  zip.file('word/styles.xml','<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman"/><w:sz w:val="26"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>')
  return zip.generateAsync({ type: 'arraybuffer' })
}

test('local DOCX normalizes body paragraphs while preserving the original opening, tables and page geometry', async () => {
  const { load } = harness()
  const bytes = await fixture()
  const state = await load('src/lib/local-file.ts').importLocalFile(new File([bytes], 'Cảnh báo.docx'))
  const source = await load('src/lib/import-docx.ts').importDocx(bytes, 'Cảnh báo.docx')
  assert.deepEqual(state.sourceLayout, { ...source.sourceLayout, differentFirstPage: true })
  assert.deepEqual(state.sourceSections, source.sourceSections)
  assert.equal(state.agencyMain, 'BẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH')
  assert.equal(state.docSummary, 'cảnh báo chi phí KCB BHYT\ntăng cao 9 tháng đầu năm 2026')
  assert.equal(state.recipient, 'Trung tâm Y tế Khu vực Cao Lãnh 2')
  assert.ok(!state.mainContent.includes('CỘNG HÒA'))
  assert.ok(!state.mainContent.includes('Kính gửi:'))
  assert.ok(state.mainContent.includes('Thực hiện quy định'))
  const table = state.mainContentBlocks.find(block => block.type === 'table')
  assert.deepEqual(table, source.mainContentBlocks.find(block => block.type === 'table'))
  assert.equal(table.cellStyles[0][0].fontSize, 9)
  const body = state.mainContentBlocks.find(block => block.text?.startsWith('Thực hiện'))
  assert.equal(body.style.fontSize, 14)
  assert.equal(body.runs[0].style.fontSize, 14)
  assert.equal(body.style.line, 18)
  assert.deepEqual(state.mainContentBlocks.find(block => block.text?.startsWith('Đơn vị')), source.mainContentBlocks.find(block => block.text?.startsWith('Đơn vị')))
  assert.deepEqual(table.merges[0], { row: 0, column: 0, colSpan: 1, rowSpan: 2 })
  const normalize = load('src/lib/normalize-imported-document.ts').normalizeImportedDocument
  assert.deepEqual(normalize(state), state, 'reopening a normalized Drive snapshot is stable')
  const React = require('react')
  const preview = require('react-dom/server').renderToStaticMarkup(React.createElement(load('src/components/document-editor/A4Preview.tsx').default, { state }))
  assert.match(preview, /font-size:9pt/)
  assert.match(preview, /font-size:14pt/)
  const blob = await load('src/components/document-editor/exportDocx.ts').createDocxBlob(state)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml').async('string')
  const doc = new dom.window.DOMParser().parseFromString(xml, 'application/xml')
  const margins = doc.getElementsByTagName('w:pgMar')[0]
  const freshBlob = await load('src/components/document-editor/exportDocx.ts').createDocxBlob(source)
  const freshZip = await JSZip.loadAsync(await freshBlob.arrayBuffer())
  const freshDoc = new dom.window.DOMParser().parseFromString(await freshZip.file('word/document.xml').async('string'), 'application/xml')
  assert.equal(margins.outerHTML, freshDoc.getElementsByTagName('w:pgMar')[0].outerHTML)
  assert.equal(doc.getElementsByTagName('w:pgSz')[0].outerHTML, freshDoc.getElementsByTagName('w:pgSz')[0].outerHTML)
  assert.match(xml, /Times New Roman/)
})

test('normalizing an older Drive snapshot keeps edits, images and structured fields', async () => {
  const { load } = harness()
  const source = await load('src/lib/import-docx.ts').importDocx(await fixture(), 'Drive.docx')
  source.agencyMain = 'CƠ QUAN ĐÃ SỬA'
  source.recipient = 'ĐƠN VỊ ĐÃ SỬA'
  const image = { type: 'image', src: 'data:image/png;base64,AAAA', width: 100, height: 50, alt: 'Biểu đồ' }
  source.mainContentBlocks.push(image)
  source.sourceFooter = [{ type: 'paragraph', text: '1', runs: [{ text: '1', field: 'PAGE' }] }]
  const normalize = load('src/lib/normalize-imported-document.ts').normalizeImportedDocument
  const state = normalize(source)
  assert.equal(state.agencyMain, 'CƠ QUAN ĐÃ SỬA')
  assert.equal(state.recipient, 'ĐƠN VỊ ĐÃ SỬA')
  assert.deepEqual(state.mainContentBlocks.at(-1), image)
  assert.deepEqual(state.sourceFooter, [], 'the old footer page number is replaced by centered header numbering')
  const structured = { ...state, legalBasis: 'Căn cứ được giữ nguyên', conclusion: 'Kết luận riêng./.', docType: 'bien-ban' }
  const reopened = normalize(structured)
  assert.equal(reopened.legalBasis, structured.legalBasis)
  assert.equal(reopened.conclusion, structured.conclusion)
  assert.deepEqual(reopened.mainContentBlocks.find(block => block.type === 'table'), source.mainContentBlocks.find(block => block.type === 'table'))
})

test('both table and paragraph signature layouts retain original typography through normalization and export', async () => {
  for (const tableSignature of [true, false]) {
    const { load } = harness()
    const zip = await JSZip.loadAsync(await fixture())
    const recipient = p('Nơi nhận:', 22, '<w:jc w:val="left"/>', '<w:b/><w:i/>') + p('- Như trên;', 22) + p('- Giám đốc BHXH cơ sở;', 22) + p('- Lưu: VT, CĐBHYT.', 22)
    const signer = p('GIÁM ĐỐC', 26, '<w:jc w:val="center"/>', '<w:b/>') + p('', 26) + p('Đoàn Văn Đồng', 26, '<w:jc w:val="center"/>', '<w:b/>')
    const footer = tableSignature ? `<w:tbl><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr><w:tc>${recipient}</w:tc><w:tc>${signer}</w:tc></w:tr></w:tbl>` : recipient + signer
    zip.file('word/document.xml', (await zip.file('word/document.xml').async('string')).replace('<w:sectPr>', `${footer}<w:sectPr>`))
    const original = await load('src/lib/import-docx.ts').importDocx(await zip.generateAsync({ type: 'arraybuffer' }), 'Giữ định dạng.docx')
    const normalize = load('src/lib/normalize-imported-document.ts').normalizeImportedDocument
    const normalized = normalize(original)
    const sourceBlocks = load('src/lib/source-administrative.ts').sourceDocumentBlocks
    const protectedBlocks = blocks => blocks.filter(block => block.type === 'table' || (block.type === 'paragraph' && /^(?:Nơi nhận:|- |GIÁM ĐỐC|Đoàn Văn Đồng)/u.test(block.text)))
    assert.deepEqual(protectedBlocks(sourceBlocks(normalized)), protectedBlocks(sourceBlocks(original)))
    assert.deepEqual(normalize(normalized), normalized)
    const exported = await load('src/components/document-editor/exportDocx.ts').createDocxBlob(normalized)
    const reopened = await load('src/lib/import-docx.ts').importDocx(await exported.arrayBuffer(), 'Đã lưu.docx')
    const allText = sourceBlocks(reopened).map(block => block.type === 'table' ? block.rows.flat().join('\n') : block.text || '').join('\n')
    assert.equal((allText.match(/Nơi nhận:/g) || []).length, 1)
    assert.equal((allText.match(/Đoàn Văn Đồng/g) || []).length, 1)
    assert.equal(reopened.signName, 'Đoàn Văn Đồng')
  }
})

test('normalized Word hides the first page number, numbers subsequent pages and indents the closing paragraph outside the signature', async () => {
  const { load } = harness()
  const zip = await JSZip.loadAsync(await fixture())
  const conclusion = 'Bảo hiểm xã hội cơ sở Cao Lãnh gửi thông tin cảnh báo đến Trung tâm Y tế Khu vực Cao Lãnh 2./.'
  const footer = `<w:tbl><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr><w:tc>${p('Nơi nhận:',22,'','<w:b/><w:i/>')}${p('- Như trên;',22)}</w:tc><w:tc>${p('GIÁM ĐỐC',26,'<w:jc w:val="center"/>','<w:b/>')}${p('Đoàn Văn Đồng',26,'<w:jc w:val="center"/>','<w:b/>')}</w:tc></w:tr></w:tbl>`
  zip.file('word/document.xml', (await zip.file('word/document.xml').async('string')).replace('<w:sectPr>', `${p(conclusion,26,'<w:ind w:firstLine="0"/>')}${footer}<w:sectPr>`))
  const original = await load('src/lib/import-docx.ts').importDocx(await zip.generateAsync({type:'arraybuffer'}), 'Đoạn kết.docx')
  assert.equal(original.sourceSections.closing.find(block => block.text === conclusion).style.firstLine, 0)
  const normalize = load('src/lib/normalize-imported-document.ts').normalizeImportedDocument
  const state = normalize(original)
  assert.equal(state.sourceSections.closing.find(block => block.text === conclusion).style.firstLine, 36)
  assert.deepEqual(state.sourceSections.closing.find(block => block.type === 'table'), original.sourceSections.closing.find(block => block.type === 'table'))
  assert.deepEqual(normalize(state), state)
  const React = require('react')
  const html = require('react-dom/server').renderToStaticMarkup(React.createElement(load('src/components/document-editor/A4Preview.tsx').default, {state}))
  assert.match(html, /text-indent:36pt/)
  const blob = await load('src/components/document-editor/exportDocx.ts').createDocxBlob(state)
  const output = await JSZip.loadAsync(await blob.arrayBuffer())
  const parse = xml => new dom.window.DOMParser().parseFromString(xml, 'application/xml')
  const doc = parse(await output.file('word/document.xml').async('string'))
  assert.equal(doc.getElementsByTagName('w:titlePg').length, 1)
  const closing = Array.from(doc.getElementsByTagName('w:p')).find(node => node.textContent === conclusion)
  assert.equal(closing.getElementsByTagName('w:ind')[0].getAttribute('w:firstLine'), '720')
  const rels = parse(await output.file('word/_rels/document.xml.rels').async('string'))
  for (const ref of doc.getElementsByTagName('w:headerReference')) {
    const rel = Array.from(rels.documentElement.children).find(node => node.getAttribute('Id') === ref.getAttribute('r:id'))
    const header = await output.file(`word/${rel.getAttribute('Target')}`).async('string')
    if (ref.getAttribute('w:type') === 'first') assert.ok(!header.includes('PAGE'), 'first page has an explicit blank header')
    if (ref.getAttribute('w:type') === 'default') {
      assert.match(header, /PAGE/)
      assert.match(header, /w:jc w:val="center"/)
      assert.match(header, /w:sz w:val="28"/)
    }
  }
})

test('reopening a saved source document and adding a paragraph keeps first-line indentation', async () => {
  let current, reduce
  const { load } = harness(undefined, { useReducer(reducer, initial, initialize) { reduce = reducer; current = initialize(initial); return [current, () => {}] } })
  const state = await load('src/lib/import-docx.ts').importDocx(await fixture(), 'Saved.docx')
  load('src/components/document-editor/useDocumentReducer.ts').useDocumentReducer(state)
  assert.equal(current.sourceLayout.differentFirstPage, true)
  const updated = reduce(current, { type: 'SET_CONTENT_BLOCKS', blocks: [...current.mainContentBlocks, {type:'paragraph',text:'Đoạn mới được thêm sau khi mở file'}] })
  assert.equal(updated.mainContentBlocks.at(-1).style.firstLine, 36)
  assert.equal(updated.mainContentBlocks.at(-1).style.fontSize, 14)
  assert.deepEqual(updated.mainContentBlocks.find(block => block.type === 'table'), state.mainContentBlocks.find(block => block.type === 'table'))
})

test('centered minutes titles and the following document number retain their original layout; page two displays 2', async () => {
  for (const splitTitle of [false, true]) {
    const { load } = harness()
    const zip = await JSZip.loadAsync(await fixture())
    const centered = '<w:jc w:val="center"/><w:ind w:firstLine="0"/><w:spacing w:before="0" w:after="0" w:line="240"/>'
    const title = splitTitle ? p('BIÊN BẢN',28,centered,'<w:b/>') + p('LÀM VIỆC',28,centered,'<w:b/>') : p('BIÊN BẢN LÀM VIỆC',28,centered,'<w:b/>')
    const opening = p('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',28,centered,'<w:b/>') + p('Độc lập - Tự do - Hạnh phúc',28,centered,'<w:b/><w:u w:val="single"/>') + title + p('Số: 02/BB',28,centered,'<w:b/>')
    const body = p('Hôm nay, chúng tôi tiến hành làm việc về nội dung sau đây.',24,'<w:jc w:val="left"/><w:ind w:firstLine="0"/>','<w:b/>')
    zip.file('word/document.xml', `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${opening}${body}<w:sectPr><w:pgNumType w:start="2"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:bottom="1134" w:left="1440" w:right="720"/></w:sectPr></w:body></w:document>`)
    const original = await load('src/lib/import-docx.ts').importDocx(await zip.generateAsync({type:'arraybuffer'}), 'Biên bản làm việc.docx')
    const state = load('src/lib/normalize-imported-document.ts').normalizeImportedDocument(original)
    assert.equal(state.docType, 'bien-ban')
    assert.equal(state.docNumber, '02')
    assert.equal(state.docSymbol, 'BB')
    assert.deepEqual(state.sourceSections.opening, original.mainContentBlocks.slice(0, -1))
    assert.equal(state.mainContentBlocks.length, 1, 'title and document number stay outside body normalization')
    assert.equal(state.mainContentBlocks[0].style.firstLine, 36)
    assert.equal(state.mainContentBlocks[0].style.fontSize, 13)
    assert.deepEqual(load('src/lib/normalize-imported-document.ts').normalizeImportedDocument(state), state)
    const blob = await load('src/components/document-editor/exportDocx.ts').createDocxBlob(state)
    const output = await JSZip.loadAsync(await blob.arrayBuffer())
    const xml = new dom.window.DOMParser().parseFromString(await output.file('word/document.xml').async('string'), 'application/xml')
    const paragraphs = Array.from(xml.getElementsByTagName('w:p'))
    for (const text of ['CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', 'Độc lập - Tự do - Hạnh phúc', ...(splitTitle ? ['BIÊN BẢN','LÀM VIỆC'] : ['BIÊN BẢN LÀM VIỆC']), 'Số: 02/BB']) {
      const matches = paragraphs.filter(node => node.textContent === text)
      assert.equal(matches.length, 1)
      assert.equal(matches[0].getElementsByTagName('w:jc')[0].getAttribute('w:val'), 'center')
      assert.equal(matches[0].getElementsByTagName('w:ind')[0].getAttribute('w:firstLine'), '0')
    }
    assert.equal(xml.getElementsByTagName('w:titlePg').length, 1, 'first page uses its own blank header')
    assert.equal(xml.getElementsByTagName('w:pgNumType')[0].getAttribute('w:start'), '1', 'count page one invisibly so the second physical page is 2')
    const React = require('react')
    const html = require('react-dom/server').renderToStaticMarkup(React.createElement(load('src/components/document-editor/A4Preview.tsx').default, {state}))
    assert.ok(!html.includes('<header'), 'preview hides the page number on page one')
  }
})

test('cell fonts apply to selected merged cells and survive Drive validation, preview and both Word export paths', async () => {
  const { load } = harness()
  const { formatTableCellFont } = load('src/lib/table-layout.ts')
  const source = await load('src/lib/import-docx.ts').importDocx(await fixture(), 'Fonts.docx')
  const original = source.mainContentBlocks.find(block => block.type === 'table')
  const table = formatTableCellFont(original, {top:0,bottom:0,left:1,right:1}, {fontFamily:'Arial',fontSize:16})
  assert.equal(table.cellStyles[0][1].fontFamily, 'Arial')
  assert.equal(table.cellStyles[0][2].fontSize, 16, 'the selection expands across merged cells')
  assert.deepEqual(table.cellStyles[2][0], original.cellStyles[2][0])
  assert.equal(table.cellParagraphs[0][1][0].style.fontFamily, 'Arial')
  assert.equal(table.cellParagraphs[0][1][0].runs[0].style.fontSize, 16)
  assert.deepEqual(table.rows, original.rows)
  assert.deepEqual(table.merges, original.merges)
  assert.equal(formatTableCellFont(original, {top:0,bottom:0,left:0,right:0}, {fontSize:NaN,fontFamily:'Arial; color:red'}), original)
  const validator = load('src/lib/drive-document.ts').validateDriveDocument
  const state = validator({...source,mainContentBlocks:[table]})
  assert.equal(state.mainContentBlocks[0].cellStyles[0][1].fontFamily, 'Arial')
  const React = require('react')
  for (const sourceLayout of [source.sourceLayout, undefined]) {
    const current = {...state,sourceLayout,sourceSections:undefined}
    const html = require('react-dom/server').renderToStaticMarkup(React.createElement(load('src/components/document-editor/A4Preview.tsx').default, {state:current}))
    assert.match(html,/font-family:Arial/)
    const blob = await load('src/components/document-editor/exportDocx.ts').createDocxBlob(current)
    const output = await JSZip.loadAsync(await blob.arrayBuffer())
    const xml = await output.file('word/document.xml').async('string')
    assert.match(xml,/w:ascii="Arial"/)
    if (sourceLayout) {
      assert.match(xml,/w:sz w:val="32"/)
      const reopened = await load('src/lib/import-docx.ts').importDocx(await blob.arrayBuffer(),'Saved.docx')
      assert.equal(reopened.mainContentBlocks[0].cellStyles[0][1].fontFamily,'Arial')
      assert.equal(reopened.mainContentBlocks[0].cellStyles[0][1].fontSize,16)
    }
  }
  const blank = {type:'table',rows:[['A','B'],['C','D']]}
  const styled = formatTableCellFont(blank,{top:0,bottom:1,left:0,right:1},{fontFamily:'Tahoma',fontSize:12})
  assert.ok(styled.cellStyles.flat().every(style=>style.fontFamily==='Tahoma'&&style.fontSize===12))
  const resized = formatTableCellFont(styled,{top:1,bottom:1,left:1,right:1},{fontSize:14})
  assert.equal(resized.cellStyles[1][1].fontFamily,'Tahoma','changing size preserves the chosen family')
  assert.equal(resized.cellStyles[0][0].fontSize,12)
})

test('DOCX keeps the conclusion and all signature rows together for new documents and imported multi-party minutes', async () => {
  const { load } = harness()
  const defaults = load('src/types/index.ts').DEFAULT_DOCUMENT_STATE
  const conclusion = 'Biên bản được lập thành 02 bản có nội dung và giá trị pháp lý như nhau./.'
  const parse = xml => new dom.window.DOMParser().parseFromString(xml,'application/xml')
  for (const docType of ['cong-van','bien-ban']) {
    const state = {...defaults,docType,mainContent:'Nội dung chính',conclusion,partyAUnit:'TỔ GIÁM ĐỊNH SỐ 2',partyBUnit:'CƠ SỞ KHÁM BỆNH, CHỮA BỆNH',partyAName:'Trần Thị Xuân Mỹ\nTrần Trí Nhân',partyBName:'Dương Quốc Định',signName:'Đoàn Văn Đồng'}
    const blob = await load('src/components/document-editor/exportDocx.ts').createDocxBlob(state)
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    const doc = parse(await zip.file('word/document.xml').async('string'))
    const p = Array.from(doc.getElementsByTagName('w:p')).find(node=>node.textContent===conclusion)
    assert.equal(p.getElementsByTagName('w:keepNext').length,1)
    assert.equal(p.getElementsByTagName('w:keepLines').length,1)
    const tables = Array.from(doc.getElementsByTagName('w:tbl'))
    const signature = tables.at(-1)
    for (const row of signature.getElementsByTagName('w:tr')) assert.equal(row.getElementsByTagName('w:cantSplit').length,1)
    for (const paragraph of signature.getElementsByTagName('w:p')) assert.equal(paragraph.getElementsByTagName('w:keepNext').length,1)
  }
  const source = await load('src/lib/import-docx.ts').importDocx(await fixture(),'Source.docx')
  const business = source.mainContentBlocks.find(block=>block.type==='table')
  const signature = {
    type:'table',borderless:true,rows:[['TỔ GIÁM ĐỊNH SỐ 2','CƠ SỞ KHÁM BỆNH, CHỮA BỆNH'],['',''],['Trần Thị Xuân Mỹ\nTrần Trí Nhân','Dương Quốc Định']],
    cellParagraphs:[
      [[{type:'paragraph',text:'TỔ GIÁM ĐỊNH SỐ 2',style:{align:'center',bold:true}}],[{type:'paragraph',text:'CƠ SỞ KHÁM BỆNH, CHỮA BỆNH',style:{align:'center',bold:true}}]],
      [[{type:'paragraph',text:'',style:{after:72}}],[{type:'paragraph',text:'',style:{after:72}}]],
      [[{type:'paragraph',text:'Trần Thị Xuân Mỹ\nTrần Trí Nhân',style:{align:'center',pageBreakBefore:true}}],[{type:'paragraph',text:'Dương Quốc Định',style:{align:'center'}}]],
    ],
  }
  const end = [{type:'paragraph',text:'Buổi làm việc kết thúc vào hồi 16 giờ 45 phút ngày 21/10/2026.'},{type:'paragraph',text:conclusion},{type:'paragraph',text:''},signature]
  const state = {...source,docType:'bien-ban',sourceSections:undefined,mainContentBlocks:[business,...end],conclusion}
  const original = JSON.stringify(state)
  const blob = await load('src/components/document-editor/exportDocx.ts').createDocxBlob(state)
  assert.equal(JSON.stringify(state),original,'pagination must not mutate imported data or table geometry')
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const doc = parse(await zip.file('word/document.xml').async('string'))
  const tables = Array.from(doc.getElementsByTagName('w:tbl'))
  assert.equal(tables[0].getElementsByTagName('w:cantSplit').length,0,'business tables keep normal pagination')
  const footer = tables[1]
  assert.equal(footer.getElementsByTagName('w:cantSplit').length,3)
  const rows = Array.from(footer.getElementsByTagName('w:tr'))
  for (const row of rows.slice(0,-1)) for (const paragraph of row.getElementsByTagName('w:p')) assert.equal(paragraph.getElementsByTagName('w:keepNext').length,1)
  for (const paragraph of footer.getElementsByTagName('w:p')) assert.equal(paragraph.getElementsByTagName('w:keepLines').length,1)
  const names = Array.from(footer.getElementsByTagName('w:p')).find(node=>node.textContent.includes('Trần Thị Xuân Mỹ'))
  assert.ok(!Array.from(names.getElementsByTagName('w:pageBreakBefore')).some(node=>!['false','0','off'].includes(node.getAttribute('w:val'))),'a forced source break cannot split the signature')
  const closeParagraph = Array.from(doc.getElementsByTagName('w:p')).find(node=>node.textContent===conclusion)
  assert.equal(closeParagraph.getElementsByTagName('w:keepNext').length,1)
})

test('Google Docs HTML uses the same administrative template without duplicating its header', async () => {
  const { load } = harness()
  const imported = await load('src/lib/drive-document.ts').importedHtmlToDocument('<p>ỦY BAN NHÂN DÂN</p><p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p><p>Độc lập - Tự do - Hạnh phúc</p><h1>BÁO CÁO</h1><h2>Về kết quả thực hiện</h2><p>Nội dung báo cáo</p>', 'Drive')
  const state = load('src/lib/normalize-imported-document.ts').normalizeImportedDocument(imported)
  assert.equal(state.docType, 'bao-cao')
  assert.equal(state.docSummary, 'Về kết quả thực hiện')
  assert.equal(state.mainContent, 'Nội dung báo cáo')
  assert.equal(state.sourceLayout, undefined)
})

test('imports source header, both summary lines, page margins and compact merged tables', async () => {
  const { load } = harness()
  const state = await load('src/lib/import-docx.ts').importDocx(await fixture(), 'Cảnh báo.docx')
  assert.equal(state.sourceLayout.left, 72)
  assert.equal(state.sourceLayout.right, 36)
  assert.equal(load('src/lib/source-administrative.ts').sourceDocumentBlocks(state)[0].borderless, true)
  assert.match(load('src/lib/source-administrative.ts').sourceDocumentBlocks(state)[0].rows[0][0], /tăng cao 9 tháng đầu năm 2026/)
  assert.equal(load('src/lib/source-administrative.ts').sourceDocumentBlocks(state)[0].cellParagraphs[0][0][0].runs[0].style.bold, undefined)
  assert.equal(load('src/lib/source-administrative.ts').sourceDocumentBlocks(state)[0].cellParagraphs[0][0][1].runs[0].style.bold, true)
  const body = state.mainContentBlocks.find(block => block.text?.startsWith('Thực hiện'))
  assert.equal(body.style.firstLine, 36)
  assert.equal(body.style.line, 14)
  assert.equal(body.style.after, 6)
  const table = state.mainContentBlocks.at(-1)
  assert.deepEqual(table.columnWidths, [2200,1400,1300,1300,2800].map(n => n / 9000 * 100))
  assert.equal(table.cellStyles[0][0].fontSize, 9)
  assert.equal(table.cellParagraphs[0][0][0].runs[0].style.fontSize, 9)
  assert.deepEqual(table.merges[0], { row: 0, column: 0, colSpan: 1, rowSpan: 2 })
  assert.equal(load('src/lib/recognize-document.ts').repairImportedDocument(state), state)
})

test('preview and DOCX export preserve source formatting without generated headers or signatures', async () => {
  const { load } = harness()
  const state = await load('src/lib/import-docx.ts').importDocx(await fixture(), 'Cảnh báo.docx')
  const React = require('react')
  const html = require('react-dom/server').renderToStaticMarkup(React.createElement(load('src/components/document-editor/SourceDocumentPreview.tsx').default, { state }))
  assert.match(html, /font-size:9pt/)
  assert.match(html, /text-align:right/)
  assert.match(html, /border:none/)
  assert.equal((html.match(/BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP/g) || []).length, 1)
  const blob = await load('src/components/document-editor/exportSourceDocx.ts').exportSourceDocx(state)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml').async('string')
  assert.match(xml, /w:sz w:val="18"/)
  assert.match(xml, /w:gridCol w:w="2200"/)
  assert.match(xml, /w:jc w:val="right"/)
  assert.match(xml, /w:left="1440"/)
  assert.equal((xml.match(/BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP/g) || []).length, 1)
  assert.ok(!xml.includes('Nơi nhận:'))
  const reopened = await load('src/lib/import-docx.ts').importDocx(await blob.arrayBuffer(), 'Reopened.docx')
  assert.equal(reopened.mainContentBlocks.at(-1).cellStyles[0][0].fontSize, 9)
})

test('editing paragraph text keeps unaffected bold and italic runs', () => {
  const { editSourceParagraph } = harness().load('src/lib/source-format.ts')
  const block = { type: 'paragraph', text: 'Hello World', style: { align: 'right' }, runs: [{ text: 'Hello ', style: { bold: true } }, { text: 'World', style: { italic: true } }] }
  const edited = editSourceParagraph(block, 'Hi World')
  assert.equal(edited.runs.map(run => run.text).join(''), 'Hi World')
  assert.equal(edited.runs.at(-1).style.italic, true)
  assert.equal(edited.style.align, 'right')
})

test('header/footer parts and automatic numbering survive importing and exporting', async () => {
  const { load } = harness()
  const zip = await JSZip.loadAsync(await fixture())
  let xml = await zip.file('word/document.xml').async('string')
  xml = xml.replace('<w:document ', '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ').replace('<w:sectPr>', '<w:sectPr><w:headerReference w:type="default" r:id="header1"/><w:footerReference w:type="default" r:id="footer1"/>').replace('</w:body>', `${p('Mục đánh số',26,'<w:numPr><w:ilvl w:val="0"/><w:numId w:val="7"/></w:numPr>')}</w:body>`)
  zip.file('word/document.xml', xml)
  zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="header1" Target="header1.xml"/><Relationship Id="footer1" Target="footer1.xml"/></Relationships>')
  zip.file('word/header1.xml', `<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${p('Header nguồn')}</w:hdr>`)
  zip.file('word/footer1.xml', `<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${p('Footer nguồn')}</w:ftr>`)
  zip.file('word/numbering.xml','<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="7"><w:abstractNumId w:val="1"/></w:num></w:numbering>')
  const state = await load('src/lib/import-docx.ts').importDocx(await zip.generateAsync({type:'arraybuffer'}), 'Numbered.docx')
  assert.equal(state.sourceHeader[0].text, 'Header nguồn')
  assert.equal(state.sourceFooter[0].text, 'Footer nguồn')
  assert.equal(state.mainContentBlocks.at(-1).text, '1.\tMục đánh số')
  const output = await load('src/components/document-editor/exportDocx.ts').createDocxBlob(state)
  const reopened = await load('src/lib/import-docx.ts').importDocx(await output.arrayBuffer(), 'Reopened.docx')
  assert.equal(reopened.sourceHeader[0].text, 'Header nguồn')
  assert.equal(reopened.sourceFooter[0].text, 'Footer nguồn')
})

test('adding a row or pasting into a source table keeps its state valid for Drive autosave', async () => {
  const { load } = harness()
  const state = await load('src/lib/import-docx.ts').importDocx(await fixture(), 'Table.docx')
  const { changeTableStructure, pasteTableInto } = load('src/lib/table-layout.ts')
  const { validateDriveDocument } = load('src/lib/drive-document.ts')
  const table = state.mainContentBlocks.at(-1)
  const expanded = changeTableStructure(table, 'row', 3, false)
  assert.equal(expanded.cellParagraphs.length, expanded.rows.length)
  assert.doesNotThrow(() => validateDriveDocument({ ...state, mainContentBlocks: [expanded] }))
  const pasted = pasteTableInto(table, { type:'table', rows:[['Mới']], fontSize:9 }, 3, 0)
  assert.doesNotThrow(() => validateDriveDocument({ ...state, mainContentBlocks: [pasted] }))
  assert.equal(pasted.cellParagraphs[0][0][0].runs[0].style.fontSize, 9)
})

test('87003 regression: header textbox PAGE field and body line shapes are not treated as images', async () => {
  const { load } = harness()
  const zip = await JSZip.loadAsync(await fixture())
  const header = fs.readFileSync(path.join(__dirname, 'fixtures/page-number-textbox-header.xml'), 'utf8')
  const line = fs.readFileSync(path.join(__dirname, 'fixtures/word-horizontal-rule.xml'), 'utf8')
  let xml = await zip.file('word/document.xml').async('string')
  xml = xml.replace('<w:document ', '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ').replace('<w:sectPr>', '<w:sectPr><w:titlePg/><w:headerReference w:type="default" r:id="header1"/>').replace('</w:r></w:p>', `</w:r><w:r>${line}</w:r></w:p>`)
  zip.file('word/document.xml', xml)
  zip.file('word/header1.xml', header)
  zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="header1" Target="header1.xml"/></Relationships>')
  const state = await load('src/lib/import-docx.ts').importDocx(await zip.generateAsync({ type:'arraybuffer' }), '87003.docx')
  assert.equal(state.sourceLayout.differentFirstPage, true)
  assert.equal(state.sourceHeader.length, 1, 'the VML fallback must not duplicate the textbox')
  assert.equal(state.sourceHeader[0].runs[0].field, 'PAGE')
  assert.equal(state.sourceHeader[0].style.align, 'center')
  assert.ok(load('src/lib/source-administrative.ts').sourceDocumentBlocks(state)[0].cellParagraphs[0][0][0].rules[0].width > 90)
  const React = require('react')
  const preview = require('react-dom/server').renderToStaticMarkup(React.createElement(load('src/components/document-editor/SourceDocumentPreview.tsx').default, { state }))
  assert.ok(!preview.includes('<header'), 'first page must not display the default header')
  const blob = await load('src/components/document-editor/exportSourceDocx.ts').exportSourceDocx(state)
  const exported = await JSZip.loadAsync(await blob.arrayBuffer())
  assert.match(await exported.file('word/header1.xml').async('string'), /PAGE/)
  assert.match(await exported.file('word/document.xml').async('string'), /w:titlePg/)
  assert.match(await exported.file('word/document.xml').async('string'), /prst="line"/)
  const outputXml = await exported.file('word/document.xml').async('string')
  assert.ok(!outputXml.includes('<undefined'), 'generated drawings must not have a nameless XML wrapper')
  const outputDocument = new dom.window.DOMParser().parseFromString(outputXml, 'application/xml')
  for (const drawing of outputDocument.getElementsByTagName('w:drawing')) assert.equal(drawing.parentElement.tagName, 'w:r', 'drawing must be a direct run child accepted by Microsoft Word')
  for (const cell of outputDocument.getElementsByTagName('w:tc')) assert.ok(Array.from(cell.children).some(node => node.localName === 'p' || node.localName === 'tbl'), 'every Word cell must have block content')
  const reopened = await load('src/lib/import-docx.ts').importDocx(await blob.arrayBuffer(), 'Saved.docx')
  assert.equal(reopened.sourceHeader[0].runs[0].field, 'PAGE')
  assert.ok(load('src/lib/source-administrative.ts').sourceDocumentBlocks(reopened)[0].cellParagraphs[0][0][0].rules.length)
})

test('embedded header images resolve against header relationships rather than body relationships', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64')
  let calls = 0
  const { load } = harness(async blob => {
    calls++
    assert.equal(blob.type, 'image/png')
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), png)
    return { type:'image', src:`data:image/png;base64,${png.toString('base64')}`, width:1, height:1, widthPercent:100, align:'center', alt:'Header logo' }
  })
  const zip = await JSZip.loadAsync(await fixture())
  let xml = await zip.file('word/document.xml').async('string')
  xml = xml.replace('<w:document ', '<w:document xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ').replace('<w:sectPr>', '<w:sectPr><w:headerReference w:type="default" r:id="header1"/>')
  zip.file('word/document.xml', xml)
  zip.file('word/_rels/document.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="header1" Target="header1.xml"/><Relationship Id="picture1" Target="media/wrong.png"/></Relationships>')
  zip.file('word/header1.xml','<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:p><w:r><w:drawing><a:blip r:embed="picture1"/></w:drawing></w:r></w:p></w:hdr>')
  zip.file('word/_rels/header1.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="picture1" Target="media/right.png"/></Relationships>')
  zip.file('word/media/right.png', png)
  const state = await load('src/lib/import-docx.ts').importDocx(await zip.generateAsync({type:'arraybuffer'}),'Header image.docx')
  assert.equal(calls, 1)
  assert.equal(state.sourceHeader[0].type, 'image')
})

test('centered source tables wider than text margins and condensed header text keep their geometry', async () => {
  const { load } = harness()
  const zip = await JSZip.loadAsync(await fixture())
  let xml = await zip.file('word/document.xml').async('string')
  xml = xml.replace('<w:tblPr>', '<w:tblPr><w:jc w:val="center"/>').replace('<w:gridCol w:w="4500"/><w:gridCol w:w="4500"/>', '<w:gridCol w:w="4820"/><w:gridCol w:w="5103"/>').replace('<w:sz w:val="26"/>', '<w:spacing w:val="-22"/><w:sz w:val="26"/>')
  zip.file('word/document.xml', xml)
  const state = await load('src/lib/import-docx.ts').importDocx(await zip.generateAsync({type:'arraybuffer'}),'Header.docx')
  const header = load('src/lib/source-administrative.ts').sourceDocumentBlocks(state)[0]
  assert.equal(header.tableAlign, 'center')
  assert.equal(header.cellParagraphs[0][0][0].runs[0].style.characterSpacing, -1.1)
  const output = await load('src/components/document-editor/exportSourceDocx.ts').exportSourceDocx(state)
  const saved = await JSZip.loadAsync(await output.arrayBuffer())
  const body = await saved.file('word/document.xml').async('string')
  assert.match(body, /w:gridCol w:w="4820"/)
  assert.match(body, /w:gridCol w:w="5103"/)
  assert.match(body, /w:spacing w:val="-22"/)
})

test('administrative header and signature populate sections 1, 2, 5 while main content contains only business tables', async () => {
  const { load } = harness()
  const zip = await JSZip.loadAsync(await fixture())
  const tc = text => `<w:tc>${text.split('\n').map(line => p(line)).join('')}</w:tc>`
  const header = `<w:tbl><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr>${tc('BẢO HIỂM XÃ HỘI TỈNH ĐỒNG THÁP\nBẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH')}${tc('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nĐộc lập - Tự do - Hạnh phúc')}</w:tr><w:tr>${tc('Số: /BHXH-CL')}${tc('Cao Lãnh, ngày ... tháng 10 năm 2026')}</w:tr><w:tr>${tc('V/v cảnh báo chi phí KCB BHYT\ntăng cao 9 tháng đầu năm 2026')}${tc('')}</w:tr></w:tbl>`
  const footer = `<w:tbl><w:tblGrid><w:gridCol w:w="3500"/><w:gridCol w:w="1000"/><w:gridCol w:w="4500"/></w:tblGrid><w:tr>${tc('Nơi nhận:')}${tc('')}${tc('GIÁM ĐỐC')}</w:tr><w:tr>${tc('- Như trên;\n- Lưu: VT.')}${tc('')}${tc('\n\nNguyễn Văn A')}</w:tr></w:tbl>`
  let xml = await zip.file('word/document.xml').async('string')
  const start = xml.indexOf('<w:tbl>'), end = xml.indexOf('</w:tbl>') + '</w:tbl>'.length
  xml = xml.slice(0,start) + header + xml.slice(end)
  xml = xml.replace('<w:sectPr>', `${p('Đề nghị đơn vị rà soát./.')}${footer}<w:sectPr>`)
  zip.file('word/document.xml',xml)
  const state = await load('src/lib/import-docx.ts').importDocx(await zip.generateAsync({type:'arraybuffer'}),'Notice.docx')
  assert.equal(state.mainContentBlocks.filter(block => block.type === 'table').length,1)
  assert.ok(!state.mainContent.includes('Nơi nhận:'))
  assert.ok(!state.mainContent.includes('CỘNG HÒA'))
  assert.ok(!state.mainContent.includes('Kính gửi'))
  assert.equal(state.agencyMain,'BẢO HIỂM XÃ HỘI CƠ SỞ CAO LÃNH')
  assert.match(state.docSummary,/tăng cao 9 tháng đầu năm 2026/)
  assert.equal(state.signName,'Nguyễn Văn A')
  assert.equal(state.conclusion,'Đề nghị đơn vị rà soát./.')
  const valid = load('src/lib/drive-document.ts').validateDriveDocument(JSON.parse(JSON.stringify(state)))
  assert.deepEqual(valid.sourceSections,state.sourceSections)
  const edited = { ...state, agencyMain:'CƠ QUAN MỚI', docNumber:'123', docSymbol:'VB', location:'Đồng Tháp', date:'2026-11-02', docSummary:'Trích yếu mới', recipient:'Đơn vị mới', signName:'Trần Văn B', signPosition:'PHÓ GIÁM ĐỐC', signAuthority:'KT. GIÁM ĐỐC', recipientsCc:'- Đơn vị mới;\n- Lưu: VT.', conclusion:'Nội dung kết luận mới./.' }
  const blocks = load('src/lib/source-administrative.ts').sourceDocumentBlocks(edited)
  const text = load('src/lib/recognize-document.ts').contentBlocksText(blocks)
  for (const expected of ['CƠ QUAN MỚI','Số: 123/VB','ngày 02 tháng 11 năm 2026','V/v Trích yếu mới','Kính gửi: Đơn vị mới','Trần Văn B','PHÓ GIÁM ĐỐC','KT. GIÁM ĐỐC','- Đơn vị mới;','Nội dung kết luận mới./.']) assert.ok(text.includes(expected),expected)
  assert.ok(!text.includes('Nguyễn Văn A'))
  assert.equal((text.match(/CỘNG HÒA/g)||[]).length,1)
  assert.equal((text.match(/Nơi nhận:/g)||[]).length,1)
  const blob = await load('src/components/document-editor/exportSourceDocx.ts').exportSourceDocx(edited)
  const reopened = await load('src/lib/import-docx.ts').importDocx(await blob.arrayBuffer(),'Edited.docx')
  assert.equal(reopened.mainContentBlocks.filter(block => block.type === 'table').length,1)
  assert.equal(reopened.signName,'Trần Văn B')
  assert.equal(reopened.docNumber,'123')
  assert.equal(reopened.mainContentBlocks.at(-1).cellStyles[0][0].fontSize,9)
})

test('Word cell-level borders are visible in preview and survive export while administrative tables stay borderless', async () => {
  const { load } = harness()
  const zip = await JSZip.loadAsync(await fixture())
  const xml = (await zip.file('word/document.xml').async('string')).replace(/<w:tblBorders>[\s\S]*?<\/w:tblBorders>/g, '').replaceAll('<w:tcPr>', '<w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tcBorders>')
  zip.file('word/document.xml',xml)
  const state = await load('src/lib/import-docx.ts').importDocx(await zip.generateAsync({type:'arraybuffer'}),'Borders.docx')
  assert.equal(state.mainContentBlocks.at(-1).borderless,false)
  assert.equal(state.sourceSections.opening[0].borderless,true)
  const React = require('react')
  const preview = require('react-dom/server').renderToStaticMarkup(React.createElement(load('src/components/document-editor/SourceDocumentPreview.tsx').default,{state}))
  assert.match(preview,/0.5pt solid black/)
  const output = await load('src/components/document-editor/exportSourceDocx.ts').exportSourceDocx(state)
  const reopened = await load('src/lib/import-docx.ts').importDocx(await output.arrayBuffer(),'Saved.docx')
  assert.equal(reopened.mainContentBlocks.at(-1).borderless,false)
})

test('centering selected source cells updates paragraph alignment, preserves text and survives Drive and DOCX round trips', async () => {
  const { load } = harness()
  const state = await load('src/lib/import-docx.ts').importDocx(await fixture(),'Alignment.docx')
  const block = state.mainContentBlocks.at(-1)
  block.cellStyles[2].forEach(style => { style.align = 'left' })
  block.cellParagraphs[2].forEach(paras => paras.forEach(p => { p.style.align = 'left' }))
  const align = load('src/lib/table-layout.ts').alignTableCells
  const selected = align(block,{top:2,bottom:2,left:0,right:0},{align:'center',verticalAlign:'middle'})
  assert.equal(selected.cellStyles[2][0].align,'center')
  assert.equal(selected.cellStyles[2][0].verticalAlign,'middle')
  assert.equal(selected.cellParagraphs[2][0][0].style.align,'center')
  assert.equal(selected.cellStyles[2][1].align,'left')
  assert.deepEqual(selected.rows,block.rows)
  const merged = align(block,{top:1,bottom:1,left:0,right:0},{align:'center'})
  assert.equal(merged.cellParagraphs[0][0][0].style.align,'center')
  const next = load('src/lib/drive-document.ts').validateDriveDocument({...state,mainContentBlocks:[selected]})
  const output = await load('src/components/document-editor/exportSourceDocx.ts').exportSourceDocx(next)
  const reopened = await load('src/lib/import-docx.ts').importDocx(await output.arrayBuffer(),'Saved.docx')
  const saved = reopened.mainContentBlocks.at(-1)
  assert.equal(saved.cellStyles[2][0].align,'center')
  assert.equal(saved.cellStyles[2][0].verticalAlign,'middle')
  assert.equal(saved.cellStyles[2][1].align,'left')
})
