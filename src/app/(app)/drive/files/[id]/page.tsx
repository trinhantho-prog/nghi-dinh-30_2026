import { getDocuments } from '@/lib/actions/documents'
import DriveDocument from '@/components/google-drive/DriveDocument'

export default async function DriveDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { agencies, signers, documentCount } = await getDocuments()
  return <DriveDocument fileId={id} agencies={agencies} signers={signers} documentCount={documentCount} />
}
