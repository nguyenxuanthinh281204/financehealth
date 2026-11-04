import type { BgEffectDef } from './types'

/** Sóng nước: 4 lớp sóng chồng nhau (xa nhạt, gần đậm), viền bọt sáng và bọt khí nổi lên. */
const LAYERS = [
  { base: 0.2, amp: 0.075, wl: 560, speed: 0.35, top: [125, 211, 232, 0.42], bottom: [60, 150, 205, 0.5] },
  { base: 0.34, amp: 0.085, wl: 400, speed: -0.5, top: [80, 182, 228, 0.55], bottom: [40, 122, 192, 0.62] },
  { base: 0.5, amp: 0.075, wl: 310, speed: 0.72, top: [48, 146, 212, 0.72], bottom: [24, 96, 172, 0.8] },
  { base: 0.66, amp: 0.065, wl: 240, speed: -0.95, top: [28, 112, 192, 0.88], bottom: [14, 68, 140, 0.95] },
] as const

const rgba = (c: readonly number[]) => `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`

export const waves: BgEffectDef = {
  height: { soft: 0.34, strong: 0.5 },
  scale: () => 1,
  create(ctx, level) {
    const boost = level === 'strong' ? 1.35 : 1
    let W = 0, H = 0, t = Math.random() * 100
    let fills: CanvasGradient[] = []
    let bubbles: { x: number; y: number; r: number; v: number; wob: number }[] = []

    const surface = (i: number, x: number) => {
      const L = LAYERS[i]
      const k = (Math.PI * 2) / L.wl
      const ph = t * L.speed * 1.3 * boost
      return L.base * H + L.amp * H * boost * (0.65 * Math.sin(k * x + ph) + 0.35 * Math.sin(k * 1.9 * x - ph * 1.6 + i * 1.7))
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const stepX = 8
      LAYERS.forEach((_, i) => {
        ctx.beginPath()
        ctx.moveTo(0, H)
        for (let x = 0; x <= W + stepX; x += stepX) ctx.lineTo(x, surface(i, x))
        ctx.lineTo(W, H)
        ctx.closePath()
        ctx.fillStyle = fills[i]
        ctx.fill()
        // Viền bọt sáng trên đỉnh sóng
        ctx.beginPath()
        for (let x = 0; x <= W + stepX; x += stepX) {
          const y = surface(i, x)
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = `rgba(255,255,255,${0.18 + i * 0.07})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      })
      ctx.fillStyle = 'rgba(220,245,255,0.45)'
      for (const b of bubbles) {
        ctx.beginPath()
        ctx.arc(b.x + Math.sin(t * 2 + b.wob) * 3, b.y, b.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    return {
      resize(w, h) {
        W = w; H = h
        fills = LAYERS.map((L) => {
          const g = ctx.createLinearGradient(0, (L.base - L.amp) * H, 0, H)
          g.addColorStop(0, rgba(L.top))
          g.addColorStop(1, rgba(L.bottom))
          return g
        })
        bubbles = []
        draw()
      },
      frame(dt) {
        t += dt
        if (Math.random() < 0.08 * boost * (W / 400)) {
          bubbles.push({ x: Math.random() * W, y: H + 4, r: 1.5 + Math.random() * 2.5, v: 18 + Math.random() * 30, wob: Math.random() * 6 })
        }
        bubbles = bubbles.filter((b) => {
          b.y -= b.v * dt
          return b.y > surface(3, b.x) + 4
        })
        draw()
      },
    }
  },
}
