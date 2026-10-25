import type { DocumentState, MainContentBlock, MainContentParagraphBlock, SourceTextStyle } from '@/types'
import { contentBlocksText, extractAdministrativeContent, repairImportedDocument } from './recognize-document'

function normalizeParagraph(block: MainContentParagraphBlock, fontSize: number): MainContentParagraphBlock {
  // Unit captions belong to the table layout, including their right alignment.
  if (/^\s*(?:Đơn vị(?:\s+(?:tính|tiền))?|ĐVT)\s*:/iu.test(block.text)) return block
  const style: SourceTextStyle = {
    fontFamily: 'Times New Roman', fontSize, align: 'justify',
    before: 6, after: 6, line: 18, left: 0, right: 0, firstLine: 36,
    ...(block.style?.pageBreakBefore ? { pageBreakBefore: true } : {}),
  }
  return {
    ...block,
    style: { ...style, bold: block.style?.bold, italic: block.style?.italic, underline: block.style?.underline },
    runs: block.runs?.map(run => ({ ...run, style: { ...style, bold: run.style?.bold, italic: run.style?.italic, underline: run.style?.underline } })),
  }
}

/** Normalize body paragraphs; retain source administrative sections and tables. */
export function normalizeImportedDocument(input: DocumentState): DocumentState {
  if (input.sourceLayout) {
    let state = input
    {
      const blocks = state.mainContentBlocks || []
      const hints = new Set(blocks.flatMap(block => block.type === 'paragraph' && (block.style?.bold || block.runs?.every(run => run.style?.bold)) ? block.text.split('\n').map(text => text.trim()) : []))
      const result = extractAdministrativeContent(blocks, hints, input.docType)
      if (result.headerFound || result.footerFound) {
        // Recognition drops typography, so map body boundaries to original blocks.
        const matches = (original: MainContentBlock, recognized: MainContentBlock) => original === recognized || (original.type === 'paragraph' && recognized.type === 'paragraph' && original.text.split('\n').some(line => line.trim() === recognized.text.trim()))
        const first = result.blocks[0], last = result.blocks.at(-1)
        const start = first ? blocks.findIndex(block => matches(block, first)) : blocks.length
        let end = blocks.length
        if (last) {
          end = 0
          for (let i = blocks.length - 1; i >= 0; i--) {
            if (matches(blocks[i], last)) { end = i + 1; break }
          }
        }
        // Ambiguous boundaries stay untouched rather than risking source text.
        if (start >= 0 && end >= start) {
          const recognizedFields = Object.fromEntries(Object.entries(result.fields).filter(([key]) => {
            const baseline = input.sourceSections?.baseline
            return !baseline || baseline[key] === undefined || String(input[key as keyof DocumentState] ?? '') === baseline[key]
          }))
          const fields = { ...input, ...recognizedFields }
          state = {
            ...fields,
            mainContentBlocks: blocks.slice(start, end),
            sourceSections: {
              opening: [...(input.sourceSections?.opening || []), ...blocks.slice(0, start)],
              closing: [...blocks.slice(end), ...(input.sourceSections?.closing || [])],
              baseline: { ...Object.fromEntries(Object.entries(fields).flatMap(([key, value]) => typeof value === 'string' ? [[key, value]] : [])), ...input.sourceSections?.baseline },
            },
          }
        }
      }
    }
    const blocks = (state.mainContentBlocks || []).map(block => block.type === 'paragraph' ? normalizeParagraph(block, state.docType === 'bien-ban' ? 13 : 14) : block)
    return { ...state, mainContentBlocks: blocks, mainContent: contentBlocksText(blocks) }
  }

  // Text-only imports have no original Word layout to retain. Structured Drive
  // snapshots keep their existing fields, images and table formatting.
  const state = repairImportedDocument(input)
  const blocks = state.mainContentBlocks || state.mainContent.split('\n').map(text => ({ type: 'paragraph' as const, text }))
  return { ...state, mainContentBlocks: blocks, mainContent: contentBlocksText(blocks) }
}
