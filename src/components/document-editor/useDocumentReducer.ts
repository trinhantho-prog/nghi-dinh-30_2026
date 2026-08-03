'use client'

import { useReducer } from 'react'
import { DocumentState, DEFAULT_DOCUMENT_STATE } from '@/types'

type Action =
  | { type: 'SET_FIELD'; field: keyof DocumentState; value: string }
  | { type: 'LOAD'; state: DocumentState }
  | { type: 'RESET'; initialConfig?: Partial<DocumentState> }

function reducer(state: DocumentState, action: Action): DocumentState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value }
    case 'LOAD':
      return { ...action.state }
    case 'RESET':
      return { ...DEFAULT_DOCUMENT_STATE, ...action.initialConfig }
    default:
      return state
  }
}

export function useDocumentReducer(initial?: Partial<DocumentState>) {
  return useReducer(reducer, { ...DEFAULT_DOCUMENT_STATE, ...initial })
}
