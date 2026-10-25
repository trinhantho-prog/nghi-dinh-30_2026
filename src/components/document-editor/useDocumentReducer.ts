'use client'

import { useReducer } from 'react'
import { DocumentState, DEFAULT_DOCUMENT_STATE } from '@/types'
import { blocksToPlainText } from './mainContentBlocks'
import { organizeSourceDocument } from '@/lib/source-administrative'
import { normalizeImportedDocument } from '@/lib/normalize-imported-document'

function prepareDocument(state: DocumentState) {
  const organized = organizeSourceDocument(state)
  return organized.sourceLayout ? normalizeImportedDocument(organized) : organized
}

type Action =
  | { type: 'SET_FIELD'; field: keyof DocumentState; value: string }
  | { type: 'SET_CONTENT_BLOCKS'; blocks: NonNullable<DocumentState['mainContentBlocks']> }
  | { type: 'LOAD'; state: DocumentState }
  | { type: 'RESET'; initialConfig?: Partial<DocumentState> }

function reducer(state: DocumentState, action: Action): DocumentState {
  switch (action.type) {
    case 'SET_FIELD':
      if (action.field === 'date') return { ...state, date: action.value, dateText: '' }
      if (action.field === 'mainContent') {
        return prepareDocument({ ...state, mainContent: action.value, mainContentBlocks: action.value.split('\n').map(text => ({ type: 'paragraph', text })) })
      }
      return { ...state, [action.field]: action.value }
    case 'SET_CONTENT_BLOCKS':
      return prepareDocument({ ...state, mainContentBlocks: action.blocks, mainContent: blocksToPlainText(action.blocks) })
    case 'LOAD':
      return prepareDocument({ ...action.state })
    case 'RESET':
      return { ...DEFAULT_DOCUMENT_STATE, ...action.initialConfig }
    default:
      return state
  }
}

export function useDocumentReducer(initial?: Partial<DocumentState>) {
  return useReducer(reducer, { ...DEFAULT_DOCUMENT_STATE, ...initial }, prepareDocument)
}
