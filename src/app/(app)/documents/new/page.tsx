import DocumentEditor from '@/components/document-editor'
import { getDocuments } from '@/lib/actions/documents'

interface PageProps {
  searchParams: Promise<{ folder?: string }>
}

export default async function NewDocumentPage({ searchParams }: PageProps) {
  const { folder } = await searchParams
  const { agencies, signers, documentCount, storageMode } = await getDocuments()

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
