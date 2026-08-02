import { getDocuments } from '@/lib/actions/documents'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  let tenantName = 'Đơn vị Cục bộ (Local Mode)'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: tenant } = await supabase
        .from('tenant_members')
        .select('tenant_id, role, tenants(name)')
        .eq('user_id', user.id)
        .single()

      if (tenant?.tenants) {
        tenantName = (tenant.tenants as unknown as { name: string })?.name ?? 'Đơn vị của bạn'
      }
    }
  } catch (error) {
    console.warn('Dashboard Supabase error, using local mode fallback:', error)
  }

  const { documents, documentCount } = await getDocuments()

  return (
    <DashboardClient
      documents={documents as any}
      documentCount={documentCount}
      tenantName={tenantName}
    />
  )
}
