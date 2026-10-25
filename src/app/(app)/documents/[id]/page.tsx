import { getDocument } from '@/lib/actions/documents'
import DocumentPageClient from './DocumentPageClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function DocumentPage({ params }: Props) {
  const { id } = await params
  const { document, versions, agencies, signers, documentCount, storageMode } = await getDocument(id)

  return (
    <DocumentPageClient
      storageMode={storageMode}
      documentId={id}
      initialDocument={document}
      initialVersions={(versions || []) as any}
      agencies={agencies || []}
      signers={signers || []}
      documentCount={documentCount || 0}
    />
  )
}

