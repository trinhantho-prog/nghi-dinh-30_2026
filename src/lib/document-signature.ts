import type { DocumentState, MainContentBlock } from '@/types'

/** Locate the closing text without pulling the preceding business tables along. */
export function sourceClosingStart(state: DocumentState, blocks: MainContentBlock[]): number {
  let start = state.sourceSections?.closing.length ? blocks.length - state.sourceSections.closing.length : blocks.length
  const conclusion = new Set(state.conclusion.split('\n').map(line => line.trim()).filter(Boolean))
  for (let i = blocks.length - 1; i >= Math.max(0, blocks.length - 20); i--) {
    const block = blocks[i]
    if (block.type === 'image' || (block.type === 'table' && !block.borderless)) break
    if (block.type !== 'paragraph') continue
    const text = block.text.trim()
    if (conclusion.has(text) || /\.\/\.\s*$/.test(text) || /^(?:(?:Buổi|Cuộc)\s+(?:làm việc|họp).*kết thúc|Biên bản\s+(?:này\s+)?(?:được\s+)?lập thành)/iu.test(text)) start = Math.min(start, i)
  }
  return start
}

export function signatureAuthorityLines(state: Pick<DocumentState, 'agencyUpper' | 'signPosition' | 'signAuthority'>): string[] {
  // An explicitly imported empty string means the source has no TM./KT. lines.
  if (state.signAuthority !== undefined) return state.signAuthority.split('\n').map(line => line.trim()).filter(Boolean)
  const lines: string[] = []
  const agency = state.agencyUpper.trim().toUpperCase()
  if (/^TM\./iu.test(agency)) lines.push(agency)
  else if (/^(?:ỦY BAN|UỶ BAN|HỘI ĐỒNG|BAN CHẤP HÀNH|BAN THƯỜNG VỤ|HỘI)(?=\s|$)/u.test(agency)) lines.push(`TM. ${agency}`)
  if (/^phó\s+/iu.test(state.signPosition)) lines.push(`KT. ${state.signPosition.replace(/^phó\s+/iu, '').trim().toUpperCase()}`)
  return lines
}
