import { DRIVE_FOLDER, driveErrorResponse, driveFetch, driveSession, validDriveId } from '@/lib/google-drive'

export async function GET(request: Request) {
  try {
    const session = await driveSession()
    const url = new URL(request.url)
    const folder = validDriveId(url.searchParams.get('folder') || 'root')
    const allFolders = url.searchParams.get('folders') === 'all'
    const query = new URLSearchParams({ q: allFolders ? `trashed = false and mimeType = '${DRIVE_FOLDER}' and 'me' in owners` : `trashed = false and '${folder}' in parents`, spaces: 'drive', corpora: 'user', pageSize: '1000', orderBy: 'folder,name_natural', fields: 'nextPageToken,incompleteSearch,files(id,name,mimeType,modifiedTime,version,parents,capabilities(canEdit),webViewLink,size)' })
    const pageToken = url.searchParams.get('pageToken')
    if (pageToken) query.set('pageToken', pageToken)
    // Return every folder, including empty ones, and every file. Pagination is exposed to the client.
    const response = await driveFetch(session, `files?${query}`)
    const result = await response.json()
    return Response.json({ ...result, folderMimeType: DRIVE_FOLDER }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return driveErrorResponse(error) }
}
