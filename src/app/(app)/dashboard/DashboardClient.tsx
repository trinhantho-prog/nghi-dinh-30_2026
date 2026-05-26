'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { renameFolder, deleteFolder } from '@/lib/actions/documents'
import DeleteDocumentButton from './DeleteDocumentButton'

const DOC_TYPE_LABELS: Record<string, string> = {
  'cong-van': 'Công Văn',
  'bao-cao': 'Báo cáo',
  'thong-bao': 'Thông báo',
  'ke-hoach': 'Kế hoạch',
  'bien-ban': 'Biên bản',
}

const DOC_TYPE_COLORS: Record<string, string> = {
  'cong-van': 'bg-[#007AFF]/10 text-[#007AFF] border-[#007AFF]/25',
  'bao-cao': 'bg-[#AF52DE]/10 text-[#AF52DE] border-[#AF52DE]/25',
  'thong-bao': 'bg-[#FF9500]/10 text-[#FF9500] border-[#FF9500]/25',
  'ke-hoach': 'bg-[#34C759]/10 text-[#34C759] border-[#34C759]/25',
  'bien-ban': 'bg-[#FF2D55]/10 text-[#FF2D55] border-[#FF2D55]/25',
}

interface Document {
  id: string
  title: string
  doc_type: string
  updated_at: string
  created_at: string
  content?: {
    folder?: string
    [key: string]: any
  }
}

interface DashboardClientProps {
  documents: Document[]
  documentCount: number
  tenantName: string
}

export default function DashboardClient({
  documents: initialDocuments,
  documentCount: initialDocumentCount,
  tenantName,
}: DashboardClientProps) {
  const router = useRouter()
  const [folders, setFolders] = useState<string[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // Rename states
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [loadingFolder, setLoadingFolder] = useState<string | null>(null)

  // Initialize folders and merge with local storage persisted ones
  useEffect(() => {
    // 1. Gather folders from documents
    const docFolders = initialDocuments
      .map(doc => doc.content?.folder?.trim())
      .filter((f): f is string => typeof f === 'string' && f.length > 0)
    
    // 2. Gather folders from localStorage
    let localFolders: string[] = []
    try {
      const stored = localStorage.getItem('dashboard_folders')
      if (stored) {
        localFolders = JSON.parse(stored)
      }
    } catch (e) {
      // Ignored
    }

    // 3. Unique union
    const uniqueFolders = Array.from(new Set([...docFolders, ...localFolders])).sort()
    setFolders(uniqueFolders)

    // Expand folders that contain documents by default
    const defaultExpanded: Record<string, boolean> = {}
    uniqueFolders.forEach(f => {
      defaultExpanded[f] = true
    })
    setExpandedFolders(prev => ({ ...defaultExpanded, ...prev }))
  }, [initialDocuments])

  function handleCreateFolder() {
    const trimmed = newFolderName.trim()
    if (!trimmed) return

    if (folders.includes(trimmed)) {
      alert('Thư mục đã tồn tại!')
      return
    }

    const updated = [...folders, trimmed].sort()
    setFolders(updated)
    setExpandedFolders(prev => ({ ...prev, [trimmed]: true }))
    setIsCreatingFolder(false)
    setNewFolderName('')

    try {
      localStorage.setItem('dashboard_folders', JSON.stringify(updated))
    } catch (e) {
      // Ignored
    }
  }

  async function handleRenameFolder(oldName: string) {
    const trimmed = renameValue.trim()
    if (!trimmed || trimmed === oldName) {
      setRenamingFolder(null)
      return
    }

    if (folders.includes(trimmed)) {
      alert('Tên thư mục đã tồn tại!')
      return
    }

    setLoadingFolder(oldName)
    const success = await renameFolder(oldName, trimmed)
    if (success) {
      // Update local storage
      const updated = folders.map(f => f === oldName ? trimmed : f).sort()
      setFolders(updated)
      try {
        localStorage.setItem('dashboard_folders', JSON.stringify(updated))
      } catch (e) {}

      // Update expanded folders state
      setExpandedFolders(prev => {
        const copy = { ...prev }
        copy[trimmed] = copy[oldName] ?? true
        delete copy[oldName]
        return copy
      })

      router.refresh()
    } else {
      alert('Đổi tên thư mục thất bại!')
    }
    setRenamingFolder(null)
    setLoadingFolder(null)
  }

  async function handleDeleteFolder(folderName: string) {
    const docCount = folderDocsMap[folderName]?.length ?? 0
    let confirmMsg = `Xóa thư mục "${folderName}"?`
    if (docCount > 0) {
      confirmMsg += `\nCác văn bản bên trong (${docCount} văn bản) sẽ được đưa ra ngoài thư mục chính.`
    }
    
    if (!confirm(confirmMsg)) return

    setLoadingFolder(folderName)
    const success = await deleteFolder(folderName)
    if (success) {
      // Update local storage
      const updated = folders.filter(f => f !== folderName)
      setFolders(updated)
      try {
        localStorage.setItem('dashboard_folders', JSON.stringify(updated))
      } catch (e) {}

      setExpandedFolders(prev => {
        const copy = { ...prev }
        delete copy[folderName]
        return copy
      })

      router.refresh()
    } else {
      alert('Xóa thư mục thất bại!')
    }
    setLoadingFolder(null)
  }

  function startRename(folder: string) {
    setRenamingFolder(folder)
    setRenameValue(folder)
  }

  function toggleFolder(folder: string) {
    if (renamingFolder === folder) return // don't toggle when renaming
    setExpandedFolders(prev => ({ ...prev, [folder]: !prev[folder] }))
  }

  // Filter documents into folders and root
  const folderDocsMap: Record<string, Document[]> = {}
  folders.forEach(f => {
    folderDocsMap[f] = []
  })

  const rootDocs: Document[] = []

  initialDocuments.forEach(doc => {
    const f = doc.content?.folder?.trim()
    if (f && folders.includes(f)) {
      folderDocsMap[f].push(doc)
    } else {
      rootDocs.push(doc)
    }
  })

  // Bright, premium glowing organic gradient mimicking modern iOS wallpapers
  const dashboardBg = {
    background: `radial-gradient(circle at 10% 20%, rgba(255, 45, 85, 0.12) 0%, transparent 40%),
                 radial-gradient(circle at 90% 10%, rgba(0, 122, 255, 0.15) 0%, transparent 40%),
                 radial-gradient(circle at 50% 90%, rgba(175, 82, 222, 0.1) 0%, transparent 50%),
                 radial-gradient(circle at 80% 80%, rgba(255, 204, 0, 0.08) 0%, transparent 35%),
                 #f4f5f8`
  }

  function renderDocumentCard(doc: Document) {
    return (
      <div 
        key={doc.id} 
        className="bg-white/85 backdrop-blur-md rounded-[16px] border border-white/60 hover:border-[#007AFF]/35 hover:bg-white hover:shadow-sm transition-all duration-200 group"
      >
        <div className="flex items-center justify-between p-4">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border tracking-wide uppercase ${DOC_TYPE_COLORS[doc.doc_type] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                {DOC_TYPE_LABELS[doc.doc_type] || doc.doc_type}
              </span>
            </div>
            <h4 className="font-semibold text-[#1d1d1f] group-hover:text-[#007AFF] transition-colors duration-150 text-sm leading-snug truncate">
              {doc.title}
            </h4>
            <p className="text-[11px] text-[#7a7a7a] mt-1.5 flex items-center gap-1.5">
              <span className="opacity-60 text-sm leading-none">🕒</span>
              <span>Cập nhật: <span className="font-semibold text-[#333]">{new Date(doc.updated_at).toLocaleString('vi-VN')}</span></span>
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href={`/documents/${doc.id}`}
              className="text-xs bg-[#007AFF] text-white px-4.5 py-2.5 rounded-full font-semibold hover:bg-[#0066cc] hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-sm shadow-[#007AFF]/10"
            >
              Mở →
            </Link>
            <DeleteDocumentButton documentId={doc.id} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={dashboardBg} className="min-h-screen font-sans antialiased text-[#1d1d1f]">
      {/* Sleek Top nav with frosted glass effect */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-md border-b border-[#e0e0e0]/40 px-8 py-3.5 flex items-center justify-between transition-all duration-300">
        <div className="flex flex-col">
          <h1 className="text-base font-bold text-[#1d1d1f] tracking-tight flex items-center gap-1.5">
            <span className="text-lg">📄</span> Thể thức văn bản
          </h1>
          <p className="text-[10px] text-[#7a7a7a] tracking-wide uppercase font-bold mt-0.5">{tenantName}</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-[#0066cc] bg-[#0066cc]/10 px-3 py-1 rounded-full border border-[#0066cc]/10">
            {initialDocumentCount}/1000 văn bản
          </span>
          <Link 
            href="/settings" 
            className="text-xs bg-white/60 border border-[#e0e0e0] hover:bg-white text-[#1d1d1f] px-4 py-2 rounded-full font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-sm shadow-black/5"
          >
            Cài đặt
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-xs bg-white/60 border border-[#FF3B30]/20 hover:bg-[#FF3B30]/5 text-[#FF3B30] px-4 py-2 rounded-full font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] shadow-sm shadow-black/5">
              Đăng xuất
            </button>
          </form>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Sleek Apple Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">
              Danh sách văn bản
            </h2>
            <p className="text-sm text-[#7a7a7a] mt-1 font-medium">Quản lý và soạn thảo các văn bản chuẩn mực</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="flex items-center gap-1.5 bg-white/70 border border-[#e0e0e0] text-[#1d1d1f] px-4.5 py-2.5 rounded-full text-sm font-semibold hover:bg-white hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-sm"
            >
              <span className="text-base font-bold leading-none">📁</span>
              Tạo thư mục
            </button>
            <Link
              href="/documents/new"
              className="flex items-center gap-1.5 bg-gradient-to-r from-[#007AFF] via-[#0A84FF] to-[#0056B3] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:opacity-95 hover:scale-[1.03] active:scale-[0.97] transition-all duration-200 shadow-md shadow-[#007AFF]/25"
            >
              <span className="text-base font-bold leading-none">+</span>
              Văn bản mới
            </Link>
          </div>
        </div>

        {/* Inline Folder Creator */}
        {isCreatingFolder && (
          <div className="bg-white/80 backdrop-blur-md rounded-[22px] border border-white/60 p-5 shadow-lg shadow-black/[0.03] mb-8 flex items-center gap-3 animate-fade-in">
            <span className="text-3xl filter drop-shadow-sm">📁</span>
            <input
              type="text"
              placeholder="Nhập tên thư mục mới..."
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              className="flex-1 px-4 py-2.5 bg-white border border-[#e0e0e0] rounded-full text-sm focus:outline-none focus:border-[#007AFF] focus:ring-2 focus:ring-[#007AFF]/10 text-[#1d1d1f] font-medium"
              onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder() }}
              autoFocus
            />
            <button
              onClick={handleCreateFolder}
              className="bg-[#007AFF] text-white px-5 py-2.5 rounded-full text-xs font-semibold hover:bg-[#0066cc] active:scale-[0.97] transition-all duration-150"
            >
              Tạo
            </button>
            <button
              onClick={() => { setIsCreatingFolder(false); setNewFolderName('') }}
              className="bg-neutral-100 text-neutral-600 px-4 py-2.5 rounded-full text-xs font-semibold hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150"
            >
              Hủy
            </button>
          </div>
        )}

        {/* Dynamic folders grid */}
        {folders.length > 0 && (
          <div className="space-y-4 mb-8">
            <h3 className="text-sm font-bold text-[#7b8abf] uppercase tracking-wider pl-1">Thư mục ({folders.length})</h3>
            <div className="grid grid-cols-1 gap-4">
              {folders.map(folder => {
                const folderDocs = folderDocsMap[folder] || []
                const isExpanded = expandedFolders[folder]
                const isLoading = loadingFolder === folder
                const isRenaming = renamingFolder === folder

                return (
                  <div 
                    key={folder}
                    className="bg-white/60 backdrop-blur-md rounded-[24px] border border-white/50 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300"
                  >
                    {/* Folder Header */}
                    <div 
                      onClick={() => toggleFolder(folder)}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-5 cursor-pointer hover:bg-white/40 transition-colors duration-200 select-none gap-4"
                    >
                      <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <span className="text-3xl filter drop-shadow-sm leading-none shrink-0">
                          {isExpanded ? '📂' : '📁'}
                        </span>
                        
                        {isRenaming ? (
                          <div className="flex items-center gap-2 flex-1 max-w-md" onClick={e => e.stopPropagation()}>
                            <input
                              type="text"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              className="flex-1 px-3.5 py-1.5 bg-white border border-[#007AFF] rounded-full text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#007AFF]/15 text-[#1d1d1f]"
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameFolder(folder)
                                if (e.key === 'Escape') setRenamingFolder(null)
                              }}
                              autoFocus
                            />
                            <button
                              onClick={() => handleRenameFolder(folder)}
                              disabled={isLoading}
                              className="bg-[#007AFF] text-white px-3.5 py-1.5 rounded-full text-xs font-semibold hover:bg-[#0066cc] active:scale-[0.97] transition-all"
                            >
                              Lưu
                            </button>
                            <button
                              onClick={() => setRenamingFolder(null)}
                              className="bg-neutral-100 text-neutral-600 px-3.5 py-1.5 rounded-full text-xs font-semibold hover:bg-neutral-200 active:scale-[0.97] transition-all"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="truncate">
                            <h4 className="font-semibold text-base text-[#1d1d1f] tracking-tight truncate flex items-center gap-2">
                              {folder}
                              {isLoading && <span className="text-xs text-[#7a7a7a] font-normal animate-pulse">(Đang lưu...)</span>}
                            </h4>
                            <p className="text-xs text-[#7a7a7a] mt-0.5">{folderDocs.length} văn bản</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {/* Rename Folder Button */}
                          <button
                            onClick={() => startRename(folder)}
                            disabled={isLoading}
                            title="Đổi tên thư mục"
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-[#e0e0e0]/70 hover:border-[#007AFF]/40 hover:text-[#007AFF] text-[#7a7a7a] text-xs transition-all duration-200 active:scale-[0.93] shadow-sm hover:bg-[#e8f0fe]/30"
                          >
                            ✏️
                          </button>

                          {/* Delete Folder Button */}
                          <button
                            onClick={() => handleDeleteFolder(folder)}
                            disabled={isLoading}
                            title="Xóa thư mục"
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-[#e0e0e0]/70 hover:border-red-500/40 hover:text-red-500 text-[#7a7a7a] text-xs transition-all duration-200 active:scale-[0.93] shadow-sm hover:bg-red-50"
                          >
                            🗑️
                          </button>
                        </div>

                        <div className="h-4 w-[1px] bg-[#e0e0e0] mx-1 hidden sm:block" />

                        <Link
                          href={`/documents/new?folder=${encodeURIComponent(folder)}`}
                          className={`text-[11px] bg-[#007AFF]/10 text-[#007AFF] border border-[#007AFF]/15 hover:bg-[#007AFF] hover:text-white px-4 py-2.5 rounded-full font-semibold transition-all duration-200 hover:scale-[1.03] active:scale-[0.97] ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
                        >
                          + Văn bản trong thư mục
                        </Link>
                        <button 
                          onClick={() => toggleFolder(folder)}
                          disabled={isLoading}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-[#e0e0e0] hover:bg-neutral-50 text-[#7a7a7a] font-bold text-xs transition-all duration-200 shrink-0"
                        >
                          {isExpanded ? '▲' : '▼'}
                        </button>
                      </div>
                    </div>
                    
                    {/* Folder Content (Documents inside) */}
                    {isExpanded && (
                      <div className="bg-white/30 border-t border-white/40 p-5 space-y-3">
                        {folderDocs.length === 0 ? (
                          <p className="text-xs text-[#7a7a7a] italic text-center py-4">Thư mục trống. Hãy bấm "+ Văn bản trong thư mục" ở trên để thêm tài liệu.</p>
                        ) : (
                          folderDocs.map(doc => renderDocumentCard(doc))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Root Documents (Not in folder) */}
        {rootDocs.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#7b8abf] uppercase tracking-wider pl-1">
              {folders.length > 0 ? `Văn bản ngoài thư mục (${rootDocs.length})` : `Văn bản (${rootDocs.length})`}
            </h3>
            <div className="space-y-3.5">
              {rootDocs.map(doc => renderDocumentCard(doc))}
            </div>
          </div>
        )}

        {/* Global Empty State if absolutely nothing exists */}
        {initialDocuments.length === 0 && folders.length === 0 && (
          <div className="text-center py-20 bg-white/80 backdrop-blur-md rounded-[24px] border border-white/50 shadow-lg shadow-black/[0.03]">
            <div className="text-6xl mb-5 filter drop-shadow-md">📁</div>
            <p className="text-[#1d1d1f] font-semibold text-lg mb-1.5">Chưa có văn bản nào</p>
            <p className="text-sm text-[#7a7a7a] max-w-sm mx-auto leading-relaxed">
              Bấm <span className="font-semibold text-[#007AFF]">&quot;Tạo thư mục&quot;</span> hoặc <span className="font-semibold text-[#007AFF]">&quot;Văn bản mới&quot;</span> ở trên để bắt đầu soạn thảo.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
