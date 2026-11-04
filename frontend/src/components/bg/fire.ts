import type { BgEffectDef } from './types'

/**
 * Lửa cháy: mô phỏng nhiệt ở độ phân giải thấp (1 ô = 4–6 px) rồi để trình duyệt phóng to mượt.
 * Nhiệt bốc lên từ đáy, bị một bản đồ làm nguội (trôi lên mỗi khung) cắt thành các lưỡi lửa.
 */
const CONFIG = {
  soft: { cool: 1.9, embers: 0.06 },
  strong: { cool: 1.35, embers: 0.12 },
}

export const fire: BgEffectDef = {
  height: { soft: 0.42, strong: 0.62 },
  scale: () => (window.innerWidth < 700 ? 4 : 6),
  create(ctx, level) {
    const cfg = CONFIG[level]
    const palette = buildPalette()
    let W = 0, H = 0
    let heat = new Float32Array(0), next = new Float32Array(0)
    let coolMap = new Float32Array(0), coolH = 0, scroll = 0
    let image: ImageData | null = null
    let embers: { x: number; y: number; vx: number; vy: number; life: number }[] = []
    let t = 0

    const step = () => {
      t += 1
      const rows = H + 2
      // Nguồn nhiệt ở đáy: nhiễu tần số thấp tạo các lưỡi lửa cao thấp khác nhau
      for (let x = 0; x < W; x++) {
        const n = lowNoise(x * 0.09, t * 0.025)
        const v = Math.min(1, 0.5 + 0.55 * n + (Math.random() - 0.5) * 0.25)
        heat[(rows - 1) * W + x] = v
        heat[(rows - 2) * W + x] = v
      }
      // Nhiệt bốc lên: trung bình 4 ô bên dưới trừ đi bản đồ làm nguội
      for (let y = 0; y < rows - 2; y++) {
        const cy = ((y + scroll) % coolH) * W
        const r1 = (y + 1) * W, r2 = (y + 2) * W
        for (let x = 0; x < W; x++) {
          const xl = x > 0 ? x - 1 : x, xr = x < W - 1 ? x + 1 : x
          const v = (heat[r1 + xl] + heat[r1 + x] + heat[r1 + xr] + heat[r2 + x]) * 0.25 - coolMap[cy + x]
          next[y * W + x] = v > 0 ? v : 0
        }
      }
      for (let i = (rows - 2) * W; i < rows * W; i++) next[i] = heat[i]
      const tmp = heat; heat = next; next = tmp
      scroll = (scroll + 1) % coolH

      // Tàn lửa bay lên
      if (Math.random() < cfg.embers * (W / 40)) {
        embers.push({ x: Math.random() * W, y: H - 2, vx: (Math.random() - 0.5) * 0.4, vy: -(0.6 + Math.random() * 0.8), life: 1 })
      }
      embers = embers.filter((e) => {
        e.x += e.vx + Math.sin((t + e.y) * 0.08) * 0.15
        e.y += e.vy
        e.life -= 0.012
        return e.life > 0 && e.y > 0
      })
    }

    const draw = () => {
      if (!image) return
      const data = image.data
      for (let i = 0, n = W * H; i < n; i++) {
        const p = Math.min(255, (heat[i] * 255) | 0) * 4
        const o = i * 4
        data[o] = palette[p]; data[o + 1] = palette[p + 1]; data[o + 2] = palette[p + 2]; data[o + 3] = palette[p + 3]
      }
      for (const e of embers) {
        const x = e.x | 0, y = e.y | 0
        if (x < 0 || x >= W || y < 0 || y >= H) continue
        const o = (y * W + x) * 4
        const a = (e.life * 230) | 0
        if (data[o + 3] < a) { data[o] = 255; data[o + 1] = 190; data[o + 2] = 90; data[o + 3] = a }
      }
      ctx.putImageData(image, 0, 0)
    }

    return {
      resize(w, h) {
        W = w; H = h
        heat = new Float32Array(W * (H + 2))
        next = new Float32Array(W * (H + 2))
        coolH = H * 2
        coolMap = buildCoolMap(W, coolH, cfg.cool / H)
        image = ctx.createImageData(W, H)
        embers = []
        // Cho lửa bén sẵn để lần đầu bật không phải chờ cháy lên
        for (let i = 0; i < H * 1.5; i++) step()
        draw()
      },
      frame() { step(); draw() },
    }
  },
}

/** Bảng màu theo nhiệt: trong suốt → đỏ thẫm → đỏ → cam → vàng → gần trắng. */
function buildPalette() {
  const stops: [number, number, number, number, number][] = [
    [0, 90, 10, 0, 0],
    [0.18, 150, 20, 5, 0.35],
    [0.38, 215, 50, 10, 0.75],
    [0.58, 250, 115, 20, 0.92],
    [0.78, 255, 190, 60, 1],
    [1, 255, 240, 190, 1],
  ]
  const out = new Uint8ClampedArray(256 * 4)
  for (let i = 0; i < 256; i++) {
    const h = i / 255
    let k = 0
    while (k < stops.length - 2 && h > stops[k + 1][0]) k++
    const a = stops[k], b = stops[k + 1]
    const f = (h - a[0]) / (b[0] - a[0])
    out[i * 4] = a[1] + (b[1] - a[1]) * f
    out[i * 4 + 1] = a[2] + (b[2] - a[2]) * f
    out[i * 4 + 2] = a[3] + (b[3] - a[3]) * f
    out[i * 4 + 3] = (a[4] + (b[4] - a[4]) * f) * 255
  }
  return out
}

/** Bản đồ làm nguội: nhiễu ngẫu nhiên được làm mịn, cuộn lên mỗi khung để lửa tách thành lưỡi. */
function buildCoolMap(w: number, h: number, base: number) {
  let m = new Float32Array(w * h)
  for (let i = 0; i < m.length; i++) m[i] = Math.random()
  for (let pass = 0; pass < 3; pass++) {
    const o = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0
        for (let dy = -1; dy <= 1; dy++) {
          const yy = (y + dy + h) % h
          for (let dx = -1; dx <= 1; dx++) s += m[yy * w + ((x + dx + w) % w)]
        }
        o[y * w + x] = s / 9
      }
    }
    m = o
  }
  let min = Infinity, max = -Infinity
  for (const v of m) { if (v < min) min = v; if (v > max) max = v }
  const span = max - min || 1
  for (let i = 0; i < m.length; i++) {
    const v = (m[i] - min) / span
    m[i] = base * (0.15 + 1.85 * v * v)
  }
  return m
}

/** Nhiễu mượt 1 chiều (tổng vài sóng sin lệch pha) trong khoảng ~[-1, 1]. */
function lowNoise(x: number, t: number) {
  return Math.sin(x + t * 1.3) * 0.5 + Math.sin(x * 2.3 - t * 0.9 + 1.7) * 0.3 + Math.sin(x * 0.45 + t * 0.6 + 4.1) * 0.2
}
