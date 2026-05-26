import { getDocuments } from '@/lib/actions/documents'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { documents, documentCount } = await getDocuments()

  const { data: tenant } = await supabase
    .from('tenant_members')
    .select('tenant_id, role, tenants(name)')
    .eq('user_id', user.id)
    .single()

  const tenantName = (tenant?.tenants as unknown as { name: string })?.name ?? 'Đơn vị của bạn'

  return (
    <DashboardClient
      documents={documents as any}
      documentCount={documentCount}
      tenantName={tenantName}
    />
  )
}
