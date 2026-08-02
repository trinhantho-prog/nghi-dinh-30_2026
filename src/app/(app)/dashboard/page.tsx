import { getDocuments } from '@/lib/actions/documents'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const { documents, documentCount } = await getDocuments()

  return (
    <DashboardClient
      documents={documents as any}
      documentCount={documentCount}
      tenantName="Thể thức văn bản"
    />
  )
}

