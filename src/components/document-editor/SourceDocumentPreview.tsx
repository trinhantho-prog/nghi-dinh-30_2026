import type { CSSProperties } from 'react'
import type { DocumentState, MainContentBlock, MainContentParagraphBlock, SourceTextStyle } from '@/types'
import { matchingCellParagraphs } from '@/lib/source-format'
import { tableCellLayout } from '@/lib/table-layout'
import { normalizeColumnWidths } from './tableSizing'
import { sourceDocumentBlocks } from '@/lib/source-administrative'

export function sourceCss(s: SourceTextStyle = {}): CSSProperties {
  return { letterSpacing: s.characterSpacing === undefined ? undefined : `${s.characterSpacing}pt`, fontFamily: s.fontFamily, fontSize: s.fontSize ? `${s.fontSize}pt` : undefined, fontWeight: s.bold === undefined ? undefined : s.bold ? 'bold' : 'normal', fontStyle: s.italic === undefined ? undefined : s.italic ? 'italic' : 'normal', textDecoration: s.underline ? 'underline' : undefined, textAlign: s.align, marginTop: `${s.before || 0}pt`, marginBottom: `${s.after || 0}pt`, lineHeight: s.line ? `${s.line}pt` : s.lineMultiple || 1, paddingLeft: `${s.left || 0}pt`, paddingRight: `${s.right || 0}pt`, textIndent: `${s.firstLine || 0}pt`, breakBefore: s.pageBreakBefore ? 'page' : undefined, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }
}

function SourceParagraph({ paragraph }: { paragraph: MainContentParagraphBlock }) {
  const runs = paragraph.runs?.map(run => run.text).join('') === paragraph.text ? paragraph.runs : undefined
  return <p style={{ ...sourceCss(paragraph.style), position: 'relative' }}>{runs?.length ? runs.map((run, i) => <span key={i} style={{ letterSpacing: run.style?.characterSpacing === undefined ? undefined : `${run.style.characterSpacing}pt`, fontFamily: run.style?.fontFamily, fontSize: run.style?.fontSize ? `${run.style.fontSize}pt` : undefined, fontWeight: run.style?.bold ? 'bold' : 'normal', fontStyle: run.style?.italic ? 'italic' : 'normal', textDecoration: run.style?.underline ? 'underline' : undefined }}>{run.field === 'PAGE' ? '1' : run.text}</span>) : paragraph.text || '\u00a0'}{paragraph.rules?.map((rule, i) => <span key={`rule-${i}`} aria-hidden="true" style={{ position: 'absolute', display: 'block', width: `${rule.width}pt`, left: `${rule.left}pt`, top: `${rule.top}pt`, borderTop: `${rule.weight}pt solid #${rule.color}` }} />)}</p>
}

function SourceBlocks({ blocks = [], contentWidth }: { blocks?: MainContentBlock[]; contentWidth: number }) {
  return <>{blocks.map((block, i) => block.type === 'paragraph' ? <SourceParagraph key={i} paragraph={block} /> : block.type === 'image' ? <div key={i} style={{ textAlign: block.align, lineHeight: 1 }}><img src={block.src} alt={block.alt} style={{ width: `${block.widthPercent}%`, height: 'auto', display: 'inline-block' }} /></div> : <table key={i} style={{ width: `${(block.sourceWidth ? block.sourceWidth * 3 / 4 : contentWidth)}pt`, tableLayout: 'fixed', borderCollapse: 'collapse', margin: 0, marginLeft: block.tableAlign === 'center' ? `${(contentWidth - (block.sourceWidth ? block.sourceWidth * 3 / 4 : contentWidth)) / 2}pt` : block.tableAlign === 'right' ? `${contentWidth - (block.sourceWidth ? block.sourceWidth * 3 / 4 : contentWidth)}pt` : 0 }}>
      <colgroup>{normalizeColumnWidths(block.columnWidths, block.rows[0].length).map((width, c) => <col key={c} style={{ width: `${width}%` }} />)}</colgroup>
      <tbody>{block.rows.map((row, r) => <tr key={r}>{row.map((text, c) => {
        const layout = tableCellLayout(block, r, c)
        if (layout.hidden) return null
        const paragraphs = matchingCellParagraphs(block.cellParagraphs?.[r]?.[c], text)
        const scale = 1
        return <td key={c} rowSpan={layout.rowSpan} colSpan={layout.colSpan} style={{ border: block.borderless ? 'none' : '0.5pt solid black', padding: '0pt 2pt', verticalAlign: layout.style.verticalAlign || 'top', whiteSpace: 'pre-wrap', overflowWrap: 'break-word', fontFamily: layout.style.fontFamily, fontSize: `${(layout.style.fontSize || block.fontSize || 11) * scale}pt`, fontWeight: layout.style.bold ? 'bold' : 'normal', textAlign: layout.style.align || 'left' }}>
          {paragraphs ? paragraphs.map((p, index) => <SourceParagraph key={index} paragraph={p} />) : text}
        </td>
      })}</tr>)}</tbody>
    </table>)}
  </>
}

export default function SourceDocumentPreview({ state }: { state: DocumentState }) {
  const page = state.sourceLayout!
  const contentWidth = page.width - page.left - page.right
  return <div className="a4-page bg-white text-black shadow-xl" style={{ position: 'relative', boxSizing: 'border-box', width: `${page.width}pt`, minHeight: `${page.height}pt`, padding: `${page.top}pt ${page.right}pt ${page.bottom}pt ${page.left}pt`, fontFamily: '"Times New Roman", Times, serif', fontSize: '11pt' }}>
    {state.sourceHeader && !page.differentFirstPage && <header style={{ position: 'absolute', top: `${page.header || 0}pt`, left: `${page.left}pt`, right: `${page.right}pt` }}><SourceBlocks blocks={state.sourceHeader} contentWidth={contentWidth} /></header>}
    <SourceBlocks blocks={sourceDocumentBlocks(state)} contentWidth={contentWidth} />
    {state.sourceFooter && !page.differentFirstPage && <footer style={{ position: 'absolute', bottom: `${page.footer || 0}pt`, left: `${page.left}pt`, right: `${page.right}pt` }}><SourceBlocks blocks={state.sourceFooter} contentWidth={contentWidth} /></footer>}
  </div>
}
