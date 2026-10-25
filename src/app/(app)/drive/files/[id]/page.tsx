import { getEditorConfig } from '@/lib/user-editor-config'
import DriveDocument from '@/components/google-drive/DriveDocument'

export default async function DriveDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { agencies, signers } = await getEditorConfig()
  return <DriveDocument fileId={id} agencies={agencies} signers={signers} documentCount={0} />
}
