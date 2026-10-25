'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function selectDocumentStorage(mode: 'browser' | 'cloud') {
  if (mode !== 'browser' && mode !== 'cloud') throw new Error('Chế độ lưu trữ không hợp lệ.')
  const store = await cookies()
  if (mode === 'browser') {
    store.set('document_storage', 'browser', { path: '/', maxAge: 31536000, sameSite: 'lax' })
    store.set('local_mode', 'true', { path: '/', maxAge: 31536000, sameSite: 'lax' })
  } else {
    store.delete('document_storage')
    store.delete('local_mode')
  }
  redirect('/dashboard')
}
