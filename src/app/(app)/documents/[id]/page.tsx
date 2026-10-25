import { loadSavedDocument } from '@/lib/document-load'
import DocumentStorageRecovery from '@/components/DocumentStorageRecovery'
import DocumentPageClient from './DocumentPageClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DocumentPage({ params }: Props) {
  const { id } = await params
  const result = await loadSavedDocument(id)
  if (!result.ok) return <DocumentStorageRecovery {...result.error} />
  const { document, versions, agencies, signers, documentCount, storageMode } = result.data

  return (
    <DocumentPageClient
      storageMode={storageMode}
      documentId={id}
      initialDocument={document}
      initialVersions={versions || []}
      agencies={agencies || []}
      signers={signers || []}
      documentCount={documentCount || 0}
    />
  )
}

