import type { MainContentBlock, MainContentImageBlock } from '@/types'

export const MAX_DOCUMENT_DATA_LENGTH = 12_000_000
export const MAX_IMAGE_DATA_LENGTH = 4_000_000

export function validateDocumentImage(value: unknown): MainContentImageBlock {
  const image = value as MainContentImageBlock
  if (!image || typeof image.src !== 'string' || image.src.length > MAX_IMAGE_DATA_LENGTH || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.src) || !Number.isFinite(image.width) || !Number.isFinite(image.height) || image.width < 1 || image.height < 1 || image.width > 20_000 || image.height > 20_000) throw new Error('Ảnh không hợp lệ hoặc quá lớn.')
  if (image.src.startsWith('data:image/png') ? !image.src.startsWith('data:image/png;base64,iVBORw0KGgo') : !image.src.startsWith('data:image/jpeg;base64,/9j/')) throw new Error('Dữ liệu ảnh không đúng định dạng PNG/JPEG.')
  return { type: 'image', src: image.src, width: image.width, height: image.height, widthPercent: typeof image.widthPercent === 'number' && Number.isFinite(image.widthPercent) ? Math.max(10, Math.min(100, image.widthPercent)) : 100, align: ['left', 'center', 'right'].includes(image.align || '') ? image.align : 'center', alt: typeof image.alt === 'string' ? image.alt.slice(0, 500) : 'Ảnh chụp màn hình' }
}

export function documentImageSize(image: MainContentImageBlock, pageWidth: number, maxHeight = 820) {
  let width = pageWidth * (image.widthPercent || 100) / 100
  let height = width * image.height / image.width
  if (height > maxHeight) { width *= maxHeight / height; height = maxHeight }
  return { width, height }
}

export function matchPreviousImageLayout(images: MainContentImageBlock[], blocks: MainContentBlock[], index: number) {
  const previous = blocks.slice(0, index + 1).findLast(block => block.type === 'image')
  return images.map(image => ({ ...image, widthPercent: previous?.type === 'image' ? previous.widthPercent || 100 : 100, align: previous?.type === 'image' ? previous.align || 'center' : 'center' as const }))
}

export async function clipboardImageBlock(file: Blob): Promise<MainContentImageBlock> {
  if (!file.type.startsWith('image/') || file.size > 20 * 1024 * 1024) throw new Error('Chỉ hỗ trợ ảnh tối đa 20 MB. Hãy chụp vùng nhỏ hơn.')
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 40_000_000) throw new Error('Kích thước ảnh quá lớn. Hãy chụp vùng nhỏ hơn.')
    const scale = Math.min(1, 2048 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Trình duyệt không đọc được ảnh.')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    return validateDocumentImage({ type: 'image', src: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height, widthPercent: 100, align: 'center', alt: 'Ảnh chụp màn hình' })
  } finally { URL.revokeObjectURL(url) }
}
