'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

const FOLDER = 'application/vnd.google-apps.folder'
const DOC = 'application/vnd.google-apps.document'
const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
type Entry = { id: string; name: string; mimeType: string; parents?: string[]; modifiedTime?: string; capabilities?: { canEdit?: boolean } }
type Session = { configured: boolean; connected: boolean; email?: string }
const button = 'rounded-lg border border-[#dde1ef] bg-white px-3 py-2 text-sm font-semibold text-[#1a56b0] hover:bg-blue-50 disabled:opacity-50'

async function readJson(response: Response) {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Không thể tải Google Drive.')
  return data
}

async function allPages(query: string, signal: AbortSignal): Promise<Entry[]> {
  const entries: Entry[] = []
  const seen = new Set<string>()
  let pageToken = ''
  do {
    const data = await readJson(await fetch(`/api/drive/files?${query}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { signal, cache: 'no-store' }))
    if (data.incompleteSearch) throw new Error('Drive chưa trả về đầy đủ kết quả. Vui lòng tải lại.')
    entries.push(...(data.files || []))
    pageToken = data.nextPageToken || ''
    if (pageToken && seen.has(pageToken)) throw new Error('Không thể tải hết các thư mục. Vui lòng thử lại.')
    seen.add(pageToken)
  } while (pageToken)
  return entries
}

export default function DriveBrowser({ initialError }: { initialError?: string }) {
  const [session, setSession] = useState<Session | null>(null)
  const [folders, setFolders] = useState<Entry[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [folder, setFolder] = useState('root')
  const [search, setSearch] = useState('')
  const [folderSearch, setFolderSearch] = useState('')
  const [error, setError] = useState(initialError === 'authorization' ? 'Chưa cấp đủ quyền Google Drive hoặc kết nối đã bị hủy. Hãy kết nối lại.' : '')
  const [loading, setLoading] = useState(false)
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/drive/session', { signal: controller.signal, cache: 'no-store' }).then(readJson).then(setSession).catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [revision])

  useEffect(() => {
    if (!session?.connected) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setFoldersLoading(true)
      allPages('folders=all', controller.signal).then(setFolders).catch(error => { if (!controller.signal.aborted) setError(error.message) }).finally(() => { if (!controller.signal.aborted) setFoldersLoading(false) })
    }, 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [session?.connected, revision])

  useEffect(() => {
    if (!session?.connected) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoading(true)
      setError('')
      setEntries([])
      allPages(`folder=${encodeURIComponent(folder)}`, controller.signal).then(setEntries).catch(error => { if (!controller.signal.aborted) setError(error.message) }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    }, 0)
    return () => { clearTimeout(timer); controller.abort() }
  }, [session?.connected, folder, revision])

  const folderById = useMemo(() => new Map(folders.map(entry => [entry.id, entry])), [folders])
  const folderPath = useCallback((entry: Entry): string => {
    const chain = [entry.name]
    const seen = new Set([entry.id])
    let parent = entry.parents?.map(id => folderById.get(id)).find(Boolean)
    while (parent && !seen.has(parent.id)) {
      chain.unshift(parent.name)
      seen.add(parent.id)
      const parents = parent.parents
      parent = parents?.map(id => folderById.get(id)).find(Boolean)
    }
    return chain.join(' / ')
  }, [folderById])

  async function disconnect() {
    try {
      await readJson(await fetch('/api/drive/session', { method: 'DELETE' }))
      setSession(previous => previous ? { ...previous, connected: false } : null)
      setEntries([]); setFolders([]); setFolder('root')
    } catch (error) { setError(error instanceof Error ? error.message : 'Không thể ngắt kết nối.') }
  }

  return (
    <div className="min-h-screen bg-[#f4f5f8] text-[#1a1f36]">
      <header className="flex flex-wrap items-center justify-between gap-3 bg-[#1a56b0] px-6 py-4 text-white">
        <div><h1 className="font-bold">Google Drive cá nhân</h1><p className="text-xs opacity-80">Nguồn tài liệu và tự động lưu file gốc</p></div>
        <div className="flex gap-3 text-sm"><Link href="/dashboard">← Danh sách văn bản</Link><Link href="/settings">Cài đặt ban đầu</Link></div>
      </header>
      <main className="mx-auto max-w-7xl space-y-4 p-6">
        {!session && <p role="status">Đang kiểm tra kết nối Drive...</p>}
        {session && !session.configured && <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm"><h2 className="font-bold">Chưa cấu hình kết nối Google Drive</h2><p className="mt-2">Cần thiết lập Google OAuth Client ID, Client Secret và khóa mã hóa phiên trên máy chủ. Sau khi cấu hình, kết nối tài khoản Google cá nhân tại đây.</p></div>}
        {session?.configured && !session.connected && <div className="rounded-xl border border-[#dde1ef] bg-white p-5"><p className="mb-3 text-sm">Kết nối tài khoản để xem tất cả thư mục, kể cả thư mục trống. File Google Docs và Word (.docx) được mở trong trình soạn thảo hành chính và tự lưu về đúng file trên Drive.</p><a href="/api/drive/connect" className={button}>Kết nối tài khoản Google Drive</a></div>}
        {session?.connected && <>
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 text-sm"><span className="mr-auto">Đã kết nối: <strong>{session.email}</strong></span><button className={button} onClick={() => setRevision(value => value + 1)}>Tải lại</button><a href="/api/drive/connect" className={button}>Đổi tài khoản</a><button className={button} onClick={disconnect}>Ngắt kết nối</button></div>
          <div className="grid gap-4 md:grid-cols-[300px_1fr]">
            <aside className="rounded-xl border border-[#dde1ef] bg-white p-4">
              <h2 className="mb-2 text-sm font-bold">Thư mục của tôi ({folders.length})</h2>
              <input aria-label="Tìm thư mục Drive" value={folderSearch} onChange={e => setFolderSearch(e.target.value)} placeholder="Tìm thư mục..." className="mb-3 w-full rounded border border-[#dde1ef] p-2 text-sm" />
              {foldersLoading && <p className="mb-2 text-xs" role="status">Đang tải đầy đủ thư mục...</p>}
              <nav className="max-h-[65vh] space-y-1 overflow-y-auto" aria-label="Các thư mục Google Drive">
                <button className={`w-full rounded p-2 text-left text-sm ${folder === 'root' ? 'bg-blue-100 font-semibold' : 'hover:bg-blue-50'}`} onClick={() => setFolder('root')}>📁 Drive của tôi</button>
                {folders.map(entry => ({ entry, path: folderPath(entry) })).filter(item => item.path.toLocaleLowerCase('vi').includes(folderSearch.toLocaleLowerCase('vi'))).sort((a, b) => a.path.localeCompare(b.path, 'vi')).map(({ entry, path }) => <button key={entry.id} title={path} className={`block w-full break-words rounded p-2 text-left text-xs ${folder === entry.id ? 'bg-blue-100 font-semibold' : 'hover:bg-blue-50'}`} onClick={() => setFolder(entry.id)}>📁 {path}</button>)}
              </nav>
            </aside>
            <section className="min-w-0 rounded-xl border border-[#dde1ef] bg-white p-4">
              <h2 className="mb-3 break-words font-bold">Drive của tôi{folder !== 'root' ? ` / ${folders.find(item => item.id === folder) ? folderPath(folders.find(item => item.id === folder)!) : 'Thư mục'}` : ''}</h2>
              <input aria-label="Tìm file trong thư mục" placeholder="Tìm file trong thư mục hiện tại..." value={search} onChange={e => setSearch(e.target.value)} className="mb-4 w-full rounded border border-[#dde1ef] p-2 text-sm" />
              <p className="mb-3 text-xs text-slate-500">File được nhập theo mẫu hành chính của ứng dụng. Sau khi bạn chỉnh sửa, nội dung mới sẽ tự lưu vào file gốc; tên file và thư mục được giữ nguyên.</p>
              {loading ? <p role="status">Đang tải file...</p> : <ul className="divide-y divide-slate-100">
                {entries.filter(entry => entry.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi'))).map(entry => <li key={entry.id} className="flex flex-wrap items-center gap-3 py-3">
                  <span className="min-w-0 flex-1 break-words text-sm">{entry.mimeType === FOLDER ? '📁' : '📄'} {entry.name}</span>
                  {entry.mimeType === FOLDER ? <button className={button} onClick={() => { setFolder(entry.id); setSearch('') }}>Mở thư mục</button> : [DOC, DOCX].includes(entry.mimeType) && entry.capabilities?.canEdit ? <Link className={button} href={`/drive/files/${entry.id}`}>Mở để chỉnh sửa</Link> : <span className="text-xs text-slate-500">{[DOC, DOCX].includes(entry.mimeType) ? 'Chỉ có quyền xem' : 'Định dạng chưa hỗ trợ chỉnh sửa'}</span>}
                </li>)}
                {!entries.length && <li className="py-10 text-center text-sm text-slate-500">Thư mục trống.</li>}
              </ul>}
            </section>
          </div>
        </>}
        {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error} <a href="/api/drive/connect" className="underline">Kết nối lại Drive</a></div>}
      </main>
    </div>
  )
}
