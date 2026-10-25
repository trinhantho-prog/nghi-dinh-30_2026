import type { MainContentParagraphBlock, SourcePageLayout, SourceTextStyle } from '@/types'

export function sourceTextStyle(value: unknown): SourceTextStyle | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Record<string, unknown>, style: SourceTextStyle = {}
  for (const key of ['fontSize', 'characterSpacing', 'before', 'after', 'line', 'lineMultiple', 'left', 'right', 'firstLine'] as const) {
    const n = input[key]
    if (typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 2000) style[key] = key === 'fontSize' ? Math.max(5, Math.min(72, n)) : n
  }
  if (typeof input.fontFamily === 'string' && /^[\p{L}\p{N} .,_-]{1,100}$/u.test(input.fontFamily)) style.fontFamily = input.fontFamily
  for (const key of ['bold', 'italic', 'underline', 'pageBreakBefore'] as const) if (typeof input[key] === 'boolean') style[key] = input[key]
  if (['left', 'center', 'right', 'justify'].includes(String(input.align))) style.align = input.align as SourceTextStyle['align']
  return style
}

export function sourceParagraph(value: unknown): MainContentParagraphBlock {
  if (!value || typeof value !== 'object') throw new Error('Đoạn văn nguồn không hợp lệ.')
  const input = value as Record<string, unknown>
  if (typeof input.text !== 'string') throw new Error('Đoạn văn nguồn không hợp lệ.')
  const style = sourceTextStyle(input.style)
  let bottomBorder: MainContentParagraphBlock['bottomBorder']
  if (input.bottomBorder !== undefined) {
    const border = input.bottomBorder as NonNullable<MainContentParagraphBlock['bottomBorder']>
    if (!border || typeof border.weight !== 'number' || !Number.isFinite(border.weight) || border.weight <= 0 || border.weight > 12 || typeof border.space !== 'number' || !Number.isFinite(border.space) || border.space < 0 || border.space > 31 || !/^[0-9a-f]{6}$/i.test(border.color)) throw new Error('Đường viền đoạn văn nguồn không hợp lệ.')
    bottomBorder = { weight: border.weight, color: border.color, space: border.space }
  }
  const rules = Array.isArray(input.rules) && input.rules.length <= 100 ? input.rules.map(rule => {
    if (!rule || !['width', 'left', 'top', 'weight'].every(key => typeof rule[key] === 'number' && Number.isFinite(rule[key]) && Math.abs(rule[key]) <= 2500) || rule.width <= 0 || rule.weight <= 0 || !/^[0-9a-f]{6}$/i.test(rule.color)) throw new Error('Đường kẻ nguồn không hợp lệ.')
    return { width: rule.width, left: rule.left, top: rule.top, weight: rule.weight, color: rule.color }
  }) : undefined
  const runs = Array.isArray(input.runs) && input.runs.length <= 10000 ? input.runs.map(run => {
    if (!run || typeof run.text !== 'string') throw new Error('Định dạng chữ nguồn không hợp lệ.')
    return { text: run.text, style: sourceTextStyle(run.style), ...(run.field === 'PAGE' || run.field === 'NUMPAGES' ? { field: run.field } : {}) }
  }) : undefined
  return { type: 'paragraph', text: input.text, ...(style ? { style } : {}), ...(rules ? { rules } : {}), ...(bottomBorder ? { bottomBorder } : {}), ...(runs?.map(run => run.text).join('') === input.text ? { runs } : {}) }
}

export function sourcePageLayout(value: unknown): SourcePageLayout {
  if (!value || typeof value !== 'object') throw new Error('Khổ trang nguồn không hợp lệ.')
  const input = value as Record<string, unknown>
  for (const key of ['width', 'height', 'top', 'bottom', 'left', 'right']) if (typeof input[key] !== 'number' || !Number.isFinite(input[key]) || Number(input[key]) < 0 || Number(input[key]) > 2500) throw new Error('Khổ trang nguồn không hợp lệ.')
  const page = input as SourcePageLayout
  if (page.width - page.left - page.right < 36 || page.height - page.top - page.bottom < 36) throw new Error('Lề trang nguồn không hợp lệ.')
  return { width: page.width, height: page.height, top: page.top, bottom: page.bottom, left: page.left, right: page.right, ...(typeof page.differentFirstPage === 'boolean' ? { differentFirstPage: page.differentFirstPage } : {}), ...(typeof page.header === 'number' && Number.isFinite(page.header) && page.header >= 0 && page.header < page.height ? { header: page.header } : {}), ...(typeof page.footer === 'number' && Number.isFinite(page.footer) && page.footer >= 0 && page.footer < page.height ? { footer: page.footer } : {}) }
}

export function matchingCellParagraphs(paragraphs: MainContentParagraphBlock[] | undefined, text: string) {
  return paragraphs?.map(p => p.text).join('\n') === text ? paragraphs : undefined
}

export function editSourceParagraph(block: MainContentParagraphBlock, text: string): MainContentParagraphBlock {
  if (!block.runs?.length || block.runs.map(run => run.text).join('') !== block.text) return { ...block, text, runs: undefined }
  let start = 0, end = block.text.length, nextEnd = text.length
  while (start < end && start < nextEnd && block.text[start] === text[start]) start++
  while (end > start && nextEnd > start && block.text[end - 1] === text[nextEnd - 1]) { end--; nextEnd-- }
  let position = 0
  const before: NonNullable<MainContentParagraphBlock['runs']> = [], after: typeof before = []
  let insertionStyle = block.style
  for (const run of block.runs) {
    const limit = position + run.text.length
    if (position <= start && limit >= start) insertionStyle = run.style
    if (position < start) before.push({ ...run, text: run.text.slice(0, Math.min(run.text.length, start - position)) })
    if (limit > end) after.push({ ...run, text: run.text.slice(Math.max(0, end - position)) })
    position = limit
  }
  return { ...block, text, runs: [...before, ...(nextEnd > start ? [{ text: text.slice(start, nextEnd), style: insertionStyle }] : []), ...after].filter(run => run.text) }
}
