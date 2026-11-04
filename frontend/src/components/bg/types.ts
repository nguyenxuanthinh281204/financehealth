import type { BgLevel } from '../../lib/background'

/** Một hiệu ứng nền: bộ khung (AnimatedBackground) lo vòng lặp, kích thước, tab ẩn, giảm chuyển động. */
export interface BgRenderer {
  /** Gọi khi canvas đổi kích thước (đơn vị: pixel của canvas). */
  resize(w: number, h: number): void
  /** Tính và vẽ một khung; dt tính bằng giây. */
  frame(dt: number): void
}

export interface BgEffectDef {
  /** Chiều cao lớp nền theo tỉ lệ màn hình, tính từ đáy lên. */
  height: Record<BgLevel, number>
  /** Số pixel CSS cho mỗi pixel canvas (lớn hơn = nhẹ hơn, mờ hơn). */
  scale: () => number
  /** Tự lấy context (2D hoặc WebGL) từ canvas; trả null nếu trình duyệt không hỗ trợ. */
  create: (canvas: HTMLCanvasElement, level: BgLevel) => BgRenderer | null
}

/** Giao diện đang tối? Đọc color-scheme thật trên <html> nên đúng cả khi chọn "Theo máy". */
export function isDarkTheme() {
  return getComputedStyle(document.documentElement).colorScheme.includes('dark')
}
