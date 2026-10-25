import type { DocumentState, MainContentBlock } from '@/types'
import { contentBlocksText, extractAdministrativeContent, repairImportedDocument } from './recognize-document'
import { sourceDocumentBlocks } from './source-administrative'

/** Use the same preview and DOCX template as a newly created document. */
export function normalizeImportedDocument(input: DocumentState): DocumentState {
  let state = input
  if (input.sourceLayout) {
    // Resolve edits in older Drive snapshots before removing their source layout.
    const blocks = [...(input.sourceHeader || []), ...sourceDocumentBlocks(input), ...(input.sourceFooter || [])]
      .filter(block => !(block.type === 'paragraph' && block.runs?.length && block.runs.every(run => run.field || !run.text.trim())))
    const hints = new Set(blocks.filter(block => block.type === 'paragraph' && (block.style?.bold || block.runs?.every(run => run.style?.bold))).map(block => block.type === 'paragraph' ? block.text.trim() : ''))
    const recognized = extractAdministrativeContent(blocks, hints, input.docType)
    state = { ...input, ...recognized.fields, mainContentBlocks: recognized.blocks }
    // Older snapshots can contain recognition mistakes in their baseline. Keep
    // explicit sidebar edits even when they could not be matched in source text.
    if (input.sourceSections) {
      for (const key of Object.keys(input.sourceSections.baseline) as (keyof DocumentState)[]) {
        if (typeof input[key] === 'string' && input[key] !== input.sourceSections.baseline[key]) {
          Object.assign(state, { [key]: input[key] })
        }
      }
    }
  } else {
    state = repairImportedDocument(input)
  }

  const fontSize = state.docType === 'bien-ban' ? 13 : 14
  const normalizeBlock = (block: MainContentBlock): MainContentBlock => {
    if (block.type === 'paragraph') return { type: 'paragraph', text: block.text }
    if (block.type === 'image') return { ...block }
    return {
      ...block,
      sourceWidth: undefined,
      fontSize,
      cellStyles: block.cellStyles?.map(row => row.map(style => ({ ...style, fontSize }))),
      cellParagraphs: undefined,
    }
  }
  const blocks = (state.mainContentBlocks || state.mainContent.split('\n').map(text => ({ type: 'paragraph' as const, text }))).map(normalizeBlock)
  // Omitting these properties selects the existing administrative template in
  // both A4Preview and createDocxBlob instead of the source-preserving renderer.
  const { sourceLayout, sourceHeader, sourceFooter, sourceSections, ...document } = state
  void sourceLayout; void sourceHeader; void sourceFooter; void sourceSections
  return { ...document, mainContentBlocks: blocks, mainContent: contentBlocksText(blocks) }
}
