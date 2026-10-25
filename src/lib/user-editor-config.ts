import { createClient } from '@/lib/supabase/server'
import { getLocalDocuments, saveLocalConfig } from '@/lib/storage/local-db'
import type { Agency, Signer } from '@/types'
import { cookies } from 'next/headers'

export type EditorConfig = { agencies: Agency[]; signers: Signer[] }

export function validateEditorConfig(value: unknown): EditorConfig {
  if (!value || typeof value !== 'object') throw new Error('Cấu hình không hợp lệ.')
  const { agencies, signers } = value as Record<string, unknown>
  if (!Array.isArray(agencies) || !Array.isArray(signers) || agencies.length > 100 || signers.length > 100) throw new Error('Danh sách cơ quan và người ký phải có tối đa 100 mục.')
  const field = (value: unknown, optional = false) => {
    if (optional && value === undefined) return ''
    if (typeof value !== 'string' || value.length > 500) throw new Error('Mỗi trường cấu hình phải là văn bản tối đa 500 ký tự.')
    return value.trim()
  }
  return {
    agencies: agencies.map(item => {
      if (!item || typeof item !== 'object') throw new Error('Thông tin cơ quan không hợp lệ.')
      return { upper: field(item.upper), main: field(item.main), location: field(item.location), suffix: field(item.suffix, true) }
    }),
    signers: signers.map(item => {
      if (!item || typeof item !== 'object') throw new Error('Thông tin người ký không hợp lệ.')
      return { position: field(item.position), name: field(item.name) }
    }),
  }
}

async function configSession() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) return null
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error && error.name !== 'AuthSessionMissingError') throw new Error('Không xác thực được tài khoản để đọc hoặc lưu cấu hình. Vui lòng kiểm tra kết nối và đăng nhập lại.')
  if (!user) {
    if ((await cookies()).get('local_mode')?.value === 'true') return null
    throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại Gmail trước khi đọc hoặc lưu cấu hình.')
  }
  return { supabase, user }
}

export async function getEditorConfig(): Promise<EditorConfig> {
  const session = await configSession()
  if (!session) {
    const { agencies, signers } = await getLocalDocuments()
    return { agencies, signers }
  }
  const config = session.user.user_metadata?.document_config
  // Never inherit a different account's tenant or local-machine settings.
  return config === undefined ? { agencies: [], signers: [] } : validateEditorConfig(config)
}

export async function saveEditorConfig(value: unknown): Promise<EditorConfig> {
  const config = validateEditorConfig(value)
  const session = await configSession()
  if (session) {
    const { data, error } = await session.supabase.auth.updateUser({ data: { document_config: config } })
    if (error || !data.user) throw new Error('Không thể lưu cấu hình vào tài khoản Gmail. Vui lòng kiểm tra kết nối và thử lại.')
    return validateEditorConfig(data.user.user_metadata.document_config)
  }
  await saveLocalConfig(config)
  return config
}
