import { getEditorConfig } from '@/lib/user-editor-config'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const { agencies, signers } = await getEditorConfig()

  return (
    <SettingsClient
      agencies={agencies}
      signers={signers}
    />
  )
}

