import DriveBrowser from '@/components/google-drive/DriveBrowser'

export default async function DrivePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <DriveBrowser initialError={(await searchParams).error} />
}
