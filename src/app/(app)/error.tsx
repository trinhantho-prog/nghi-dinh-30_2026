'use client'

import DocumentStorageRecovery from '@/components/DocumentStorageRecovery'

export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <DocumentStorageRecovery message="Ứng dụng chưa tải được trang này. Vui lòng thử lại hoặc mở kho trên trình duyệt để tiếp tục soạn thảo." retry={reset} />
}
