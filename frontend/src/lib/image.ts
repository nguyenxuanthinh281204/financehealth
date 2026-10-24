/**
 * Thu nhỏ ảnh về tối đa `maxSide` px và chuyển sang JPEG.
 * Đồng thời đổi ảnh HEIC của iPhone sang JPEG (Safari tự giải mã HEIC khi vẽ lên canvas).
 */
export async function toJpeg(file: Blob, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Không đọc được ảnh'))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không nén được ảnh'))), 'image/jpeg', quality))
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Đọc thời lượng video trên trình duyệt (giây). */
export function videoDuration(file: Blob): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.preload = 'metadata'
    v.onloadedmetadata = () => {
      // Một số video webm báo Infinity, tua tới cuối để lấy thời lượng thật
      if (v.duration === Infinity) {
        v.currentTime = 1e6
        v.ontimeupdate = () => { v.ontimeupdate = null; URL.revokeObjectURL(url); resolve(v.duration) }
      } else {
        URL.revokeObjectURL(url)
        resolve(v.duration)
      }
    }
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Không đọc được video')) }
    v.src = url
  })
}
