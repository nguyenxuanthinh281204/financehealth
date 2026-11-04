import { isDarkTheme, type BgEffectDef } from './types'

/**
 * Mưa rơi phủ toàn màn hình: hạt xa ngắn/mảnh/chậm/nhạt, hạt gần dài/đậm/nhanh.
 * Hạt rơi chạm "mặt đất" (vùng dưới màn hình) thì tạo vòng gợn nước.
 */
const CONFIG = {
  soft: { density: 7000, slant: 0.12, speed: [650, 1000] },
  strong: { density: 3200, slant: 0.22, speed: [950, 1450] },
} as const

interface Drop { x: number; y: number; z: number; v: number; land: number }
interface Ripple { x: number; y: number; r: number; max: number; life: number }

export const rain: BgEffectDef = {
  height: { soft: 1, strong: 1 },
  scale: () => 1,
  create(ctx, level) {
    const cfg = CONFIG[level]
    let W = 0, H = 0
    let drops: Drop[] = []
    let ripples: Ripple[] = []
    let dark = isDarkTheme(), themeCheck = 0

    const spawn = (d: Partial<Drop> = {}): Drop => {
      const z = 0.3 + Math.random() * 0.7
      return {
        x: Math.random() * (W + H * cfg.slant) - H * cfg.slant,
        y: -30 - Math.random() * 60,
        z,
        v: (cfg.speed[0] + Math.random() * (cfg.speed[1] - cfg.speed[0])) * z,
        land: H * (0.72 + 0.28 * z),
        ...d,
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const c = dark ? '200,222,255' : '70,98,135'
      ctx.lineCap = 'round'
      for (const d of drops) {
        const len = 8 + 20 * d.z
        ctx.strokeStyle = `rgba(${c},${(dark ? 0.12 : 0.16) + 0.4 * d.z})`
        ctx.lineWidth = 0.6 + 0.9 * d.z
        ctx.beginPath()
        ctx.moveTo(d.x, d.y)
        ctx.lineTo(d.x - len * cfg.slant, d.y - len)
        ctx.stroke()
      }
      for (const r of ripples) {
        ctx.strokeStyle = `rgba(${c},${0.45 * r.life})`
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.ellipse(r.x, r.y, r.r, r.r * 0.32, 0, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    return {
      resize(w, h) {
        W = w; H = h
        const n = Math.round((W * H) / cfg.density)
        // Rải sẵn khắp màn hình để vừa bật đã thấy mưa
        drops = Array.from({ length: n }, () => {
          const d = spawn()
          d.y = Math.random() * d.land
          return d
        })
        ripples = []
        draw()
      },
      frame(dt) {
        if (++themeCheck % 30 === 0) dark = isDarkTheme()
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i]
          d.y += d.v * dt
          d.x += d.v * cfg.slant * dt
          if (d.y >= d.land) {
            if (d.z > 0.45 && ripples.length < 80) ripples.push({ x: d.x, y: d.land, r: 1, max: 6 + 14 * d.z, life: 1 })
            drops[i] = spawn()
          }
        }
        ripples = ripples.filter((r) => {
          r.r += (r.max - r.r) * Math.min(1, dt * 6)
          r.life -= dt * 2.2
          return r.life > 0
        })
        draw()
      },
    }
  },
}
