import { loadDocumentLibrary } from '@/lib/document-load'
import DocumentStorageRecovery from '@/components/DocumentStorageRecovery'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ profileSaved?: string }> }) {
  const { profileSaved } = await searchParams
  const result = await loadDocumentLibrary()
  if (!result.ok) return <DocumentStorageRecovery {...result.error} />
  const { documents, documentCount, storageMode } = result.data
  let userEmail: string | undefined
  if (storageMode === 'cloud' && process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userEmail = user?.email
    } catch { /* Keep the dashboard accessible when using local mode offline. */ }
  }

  return (
    <DashboardClient
      storageMode={storageMode}
      documents={documents}
      documentCount={documentCount}
      tenantName="Thể thức văn bản"
      profileSaved={profileSaved === '1'}
      userEmail={userEmail}
    />
  )
}

