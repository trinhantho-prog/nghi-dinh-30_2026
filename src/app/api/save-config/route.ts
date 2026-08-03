import { NextRequest, NextResponse } from 'next/server'
import { saveTenantConfig, getDocuments } from '@/lib/actions/documents'
import { Agency, Signer } from '@/types'
import { revalidatePath } from 'next/cache'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const agencies: Agency[] = body.agencies || []
    const signers: Signer[] = body.signers || []

    await saveTenantConfig(agencies, signers)

    revalidatePath('/settings')
    revalidatePath('/documents/new')
    revalidatePath('/dashboard')
    revalidatePath('/', 'layout')

    const data = await getDocuments()

    return NextResponse.json({
      success: true,
      agencies: data.agencies,
      signers: data.signers,
    })
  } catch (error) {
    console.error('[save-config API] Error:', error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
