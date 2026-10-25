'use client'

import { useReducer } from 'react'
import { DocumentState, DEFAULT_DOCUMENT_STATE } from '@/types'
import { blocksToPlainText } from './mainContentBlocks'
import { organizeSourceDocument } from '@/lib/source-administrative'

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
        return { ...state, mainContent: action.value, mainContentBlocks: undefined }
      }
      return { ...state, [action.field]: action.value }
    case 'SET_CONTENT_BLOCKS':
      return { ...state, mainContentBlocks: action.blocks, mainContent: blocksToPlainText(action.blocks) }
    case 'LOAD':
      return organizeSourceDocument({ ...action.state })
    case 'RESET':
      return { ...DEFAULT_DOCUMENT_STATE, ...action.initialConfig }
    default:
      return state
  }
}

export function useDocumentReducer(initial?: Partial<DocumentState>) {
  return useReducer(reducer, { ...DEFAULT_DOCUMENT_STATE, ...initial }, organizeSourceDocument)
}
