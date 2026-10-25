import type { DocumentState, MainContentBlock } from '@/types'

const normalize = (text: string) => text.replace(/\u00a0/g, ' ').trim()
const isRecipients = (text: string) => /^Nơi\s*nhận\s*[:：]/iu.test(text)
const isAuthority = (text: string) => /^(?:TM|KT|TL|TUQ|Q)\s*\./iu.test(text)
const role = /^(?:(?:PHÓ|TỔNG|QUYỀN)\s+)*(?:GIÁM ĐỐC|CHỦ TỊCH|BÍ THƯ|HIỆU TRƯỞNG|TRƯỞNG (?:PHÒNG|BAN|KHOA|BỘ PHẬN|ĐƠN VỊ|ĐOÀN)|CHÁNH VĂN PHÒNG|CHÁNH THANH TRA|CỤC TRƯỞNG|CHI CỤC TRƯỞNG|VỤ TRƯỞNG|VIỆN TRƯỞNG|THỦ TRƯỞNG|THỦ TRƯỞNG ĐƠN VỊ|NGƯỜI LẬP|NGƯỜI BÁO CÁO|THƯ KÝ|CHỦ TRÌ|CHỦ TỌA|ĐẠI DIỆN(?:\s+.+)?)\s*[.:]?$/iu
const ignored = (text: string) => !text || /^[\s.\-–—_…]+$/.test(text) || /^\(?\s*(?:đã ký|ký,?\s*(?:ghi rõ họ tên|đóng dấu).*)\)?$/iu.test(text)

function lines(text: string): string[] {
  // Repair older imports that joined a role directly to a mixed-case name.
  return text.replace(/(GIÁM ĐỐC|CHỦ TỊCH|HIỆU TRƯỞNG|TRƯỞNG PHÒNG|BÍ THƯ)(?=\p{Lu}\p{Ll})/gu, '$1\n').split('\n').map(normalize).filter(Boolean)
}

function personName(text: string) {
  if (ignored(text) || isAuthority(text) || role.test(text) || /^(?:BẢO HIỂM|ỦY BAN|UỶ BAN|HỘI ĐỒNG|Nơi nhận|Kính gửi|Trên đây|Nội dung|PHẦN\s)/iu.test(text)) return false
  const words = text.split(/\s+/)
  return words.length >= 2 && words.length <= 7 && words.every(word => /^\p{Lu}[\p{L}'’\-]*$/u.test(word))
}

function signature(input: string[]) {
  const authority: { index: number; text: string }[] = []
  const positions: { index: number; text: string }[] = []
  let start = -1
  for (let i = 0; i < input.length; i++) {
    const text = input[i]
    if (isAuthority(text)) {
      if (start < 0) start = i
      const index = i
      if (/^(?:TM|KT|TL|TUQ|Q)\s*\.\s*$/iu.test(text) && input[i + 1] && !isAuthority(input[i + 1])) authority.push({ index, text: `${text} ${input[++i]}` })
      else authority.push({ index, text })
    } else if (role.test(text)) {
      if (start < 0) start = i
      positions.push({ index: i, text: text.replace(/[.:]+$/, '').trim() })
    }
  }
  if (start < 0) return null
  const position = positions.at(-1)
  start = position?.index ?? authority.at(-1)!.index
  while (start > 0) {
    if (isAuthority(input[start - 1]) || ignored(input[start - 1])) start--
    else if (start > 1 && role.test(input[start - 1]) && /^(?:TM|KT|TL|TUQ|Q)\s*\.\s*$/iu.test(input[start - 2])) start -= 2
    else break
  }
  const nameIndex = input.findIndex((text, i) => i > (position?.index ?? start) && personName(text))
  return { start, nameIndex, signAuthority: authority.filter(line => line.index >= start).map(line => line.text).join('\n'), signPosition: position?.text || '', signName: nameIndex < 0 ? '' : input[nameIndex] }
}

function recipients(input: string[]) {
  const output: string[] = []
  for (const text of input.flatMap(text => text.replace(/([;:.])\s*(?=[-–—•]\s)/gu, '$1\n').split('\n'))) {
    const value = text.replace(/^\s*Nơi\s*nhận\s*[:：]\s*/iu, '').trim()
    if (!value || ignored(value)) continue
    if (/^[-–—•]/u.test(value) || !output.length) output.push(value)
    else output[output.length - 1] += ` ${value}`
  }
  return output.join('\n')
}

export function extractDocumentFooter(input: MainContentBlock[], docType?: DocumentState['docType']) {
  const blocks = input.flatMap<MainContentBlock>(block => block.type === 'paragraph' ? lines(block.text).map(text => ({ type: 'paragraph', text })) : [block])
  const fields: Partial<DocumentState> = {}
  let footerFound = false
  let signatureQuality = -1

  // Word commonly uses a borderless 2- or 3-column table for recipients and signature.
  for (let index = blocks.length - 1; index >= Math.max(0, blocks.length - 5); index--) {
    if (docType === 'bien-ban') break // Preserve multi-party signature layouts for the minutes template.
    const block = blocks[index]
    if (block.type !== 'table') continue
    // A real body after a table is evidence this is not a footer table.
    if (!blocks.slice(index + 1).every(item => item.type === 'paragraph' && (ignored(item.text) || /^\d+$/.test(item.text)))) continue
    const markerRow = block.rows.findIndex(row => row.some(cell => lines(cell).some(isRecipients)))
    const startRow = markerRow < 0 ? 0 : markerRow
    const columns = Array.from({ length: block.rows[0]?.length || 0 }, (_, column) => block.rows.slice(startRow).flatMap(row => lines(row[column] || '')))
    const recipientColumn = columns.findIndex(column => column.some(isRecipients))
    const signatures = columns.map((column, c) => ({ value: signature(column), column, c })).filter(item => item.c !== recipientColumn && item.value && (item.value.signName || recipientColumn >= 0))
    const found = signatures.at(-1)
    if (!found?.value) continue
    // With no explicit recipients label, accept only a compact signature layout.
    if (recipientColumn < 0 && (block.rows.length > 8 || columns.some((column, c) => c !== found.c && column.some(text => !ignored(text))))) continue
    const quality = found.value.signName ? 2 : 1
    if (quality >= signatureQuality) {
      Object.assign(fields, { signAuthority: found.value.signAuthority, signPosition: found.value.signPosition, signName: found.value.signName })
      if (recipientColumn >= 0) fields.recipientsCc = recipients(columns[recipientColumn])
      signatureQuality = quality
    }
    if (startRow > 0) blocks.splice(index, blocks.length - index, { ...block, rows: block.rows.slice(0, startRow) })
    else blocks.splice(index)
    footerFound = true
    // Older exported files may contain the original signature followed by an
    // extra generated footer. Remove both and prefer the complete original signer.
  }

  if (!footerFound && docType !== 'bien-ban') {
    let start = blocks.length
    while (start > 0 && blocks[start - 1].type === 'paragraph' && blocks.length - start < 40) start--
    const tail = blocks.slice(start).map(block => block.type === 'paragraph' ? block.text : '')
    const marker = tail.findIndex(isRecipients)
    const found = signature(tail)
    if (found && found.signName && found.nameIndex >= found.start && tail.slice(found.nameIndex + 1).every(text => ignored(text) || /^\d+$/.test(text))) {
      const footerStart = marker < 0 ? found.start : Math.min(marker, found.start)
      Object.assign(fields, { signAuthority: found.signAuthority, signPosition: found.signPosition, signName: found.signName })
      if (marker >= 0) {
        const end = found.start > marker ? found.start : found.nameIndex
        fields.recipientsCc = recipients(tail.slice(marker, end).filter(text => !role.test(text) && !isAuthority(text)))
      }
      blocks.splice(start + footerStart)
      footerFound = true
    }
  }

  // Move only recognizable closing text; leave unrelated final paragraphs and data tables intact.
  const closing: string[] = []
  for (let i = blocks.length - 2; i >= Math.max(0, blocks.length - 8); i--) {
    const heading = blocks[i]
    if (heading.type !== 'paragraph' || !/^(?:(?:[IVXLCDM]+|\d+)[.)]\s*)?KẾT LUẬN(?:\s+VÀ\s+(?:KIẾN NGHỊ|YÊU CẦU))?\s*[:.]?$/iu.test(heading.text)) continue
    const after = blocks.slice(i + 1)
    if (after.every(item => item.type === 'paragraph' && !/^(?:[IVXLCDM]+|\d+)[.)]\s/u.test(item.text))) {
      fields.conclusion = after.map(item => item.type === 'paragraph' ? item.text : '').join('\n')
      blocks.splice(i + 1)
    }
    break
  }
  const conclusionStart = /^(?:Trên đây(?:\s|[,.:])|(?:Kính\s+)?(?:đề nghị|yêu cầu)(?=\s|:)|Vậy(?=\s|[,.:]))/iu
  while (blocks.length && closing.length < 6) {
    const last = blocks.at(-1)!
    if (last.type !== 'paragraph') break
    if (!/\.\/\.\s*$/.test(last.text) && !(footerFound && conclusionStart.test(last.text))) break
    closing.unshift(last.text)
    blocks.pop()
  }
  if (closing.length) fields.conclusion = closing.join('\n')
  return { fields, blocks, footerFound: footerFound || Boolean(fields.conclusion) }
}
