import { getDocuments } from '@/lib/actions/documents'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ profileSaved?: string }> }) {
  const { profileSaved } = await searchParams
  const { documents, documentCount, storageMode } = await getDocuments()
  let userEmail: string | undefined
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      userEmail = user?.email
    } catch { /* Keep the dashboard accessible when using local mode offline. */ }
  }

  return (
    <DashboardClient
      storageMode={storageMode}
      documents={documents as any}
      documentCount={documentCount}
      tenantName="Thể thức văn bản"
      profileSaved={profileSaved === '1'}
      userEmail={userEmail}
    />
  )
}

