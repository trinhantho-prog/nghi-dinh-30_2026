import { NextRequest, NextResponse } from 'next/server'
import { saveLocalConfig, getLocalDocuments } from '@/lib/storage/local-db'
import { Agency, Signer } from '@/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const agencies: Agency[] = body.agencies || []
    const signers: Signer[] = body.signers || []

    await saveLocalConfig({ agencies, signers })

    // Read back to confirm
    const data = await getLocalDocuments()

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
