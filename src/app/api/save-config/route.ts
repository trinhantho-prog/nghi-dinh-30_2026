import { NextRequest, NextResponse } from 'next/server'
import { saveTenantConfig } from '@/lib/actions/documents'
import { Agency, Signer } from '@/types'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const agencies: Agency[] = body.agencies || []
    const signers: Signer[] = body.signers || []

    const data = await saveTenantConfig(agencies, signers)

    revalidatePath('/settings')
    revalidatePath('/documents/new')
    revalidatePath('/dashboard')
    revalidatePath('/', 'layout')

    return NextResponse.json({
      success: true,
      agencies: data.agencies,
      signers: data.signers,
    })
  } catch (error) {
    console.error('[save-config API] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Không thể lưu cấu hình. Vui lòng thử lại.' },
      { status: 500 }
    )
  }
}
