import DocumentEditor from '@/components/document-editor'
import { loadDocumentLibrary } from '@/lib/document-load'
import DocumentStorageRecovery from '@/components/DocumentStorageRecovery'

interface PageProps {
  searchParams: Promise<{ folder?: string }>
}

export default async function NewDocumentPage({ searchParams }: PageProps) {
  const { folder } = await searchParams
  const result = await loadDocumentLibrary()
  if (!result.ok) return <DocumentStorageRecovery {...result.error} />
  const { agencies, signers, documentCount, storageMode } = result.data

  return (
    <DocumentEditor
      storageMode={storageMode}
      agencies={agencies}
      signers={signers}
      documentCount={documentCount}
      initialData={folder ? { folder } : undefined}
    />
  )
}
