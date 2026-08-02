import { getDocuments } from '@/lib/actions/documents'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const { documentCount, agencies, signers } = await getDocuments()

  return (
    <SettingsClient
      agencies={agencies}
      signers={signers}
      documentCount={documentCount}
    />
  )
}

