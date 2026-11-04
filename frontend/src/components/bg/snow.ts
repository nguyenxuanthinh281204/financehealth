import { isDarkTheme, type BgEffectDef } from './types'

/**
 * Tuyết rơi phủ toàn màn hình: bông xa nhỏ/chậm/mờ, bông gần to/nhanh/rõ, lắc lư theo gió nhẹ.
 * Mỗi bông là một ảnh tròn mềm vẽ sẵn (drawImage nhanh hơn vẽ gradient từng bông).
 * Nền sáng dùng bông xanh xám nhạt để vẫn nhìn thấy trên nền kem.
 */
const CONFIG = {
  soft: { density: 6000, speed: [22, 55] },
  strong: { density: 2800, speed: [35, 85] },
} as const

interface Flake { x: number; y: number; z: number; v: number; phase: number; sway: number }

export const snow: BgEffectDef = {
  height: { soft: 1, strong: 1 },
  scale: () => 1,
  create(canvas, level) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const cfg = CONFIG[level]
    let W = 0, H = 0, t = 0
    let flakes: Flake[] = []
    let dark = isDarkTheme(), themeCheck = 0
    let sprite = makeSprite(dark)

    const spawn = (top: boolean): Flake => {
      const z = 0.25 + Math.random() * 0.75
      return {
        x: Math.random() * W,
        y: top ? -10 - Math.random() * 40 : Math.random() * H,
        z,
        v: (cfg.speed[0] + Math.random() * (cfg.speed[1] - cfg.speed[0])) * (0.4 + 0.6 * z),
        phase: Math.random() * Math.PI * 2,
        sway: 0.4 + Math.random() * 0.8,
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      for (const f of flakes) {
        const r = 1.6 + 4.6 * f.z
        ctx.globalAlpha = 0.35 + 0.65 * f.z
        ctx.drawImage(sprite, f.x - r, f.y - r, r * 2, r * 2)
      }
      ctx.globalAlpha = 1
    }

    return {
      resize(w, h) {
        W = w; H = h
        flakes = Array.from({ length: Math.round((W * H) / cfg.density) }, () => spawn(false))
        draw()
      },
      frame(dt) {
        if (themeCheck++ % 30 === 0) {
          const d = isDarkTheme()
          if (d !== dark) { dark = d; sprite = makeSprite(dark) }
        }
        t += dt
        const wind = 12 * Math.sin(t * 0.13) + 6 * Math.sin(t * 0.37 + 1.3)
        for (let i = 0; i < flakes.length; i++) {
          const f = flakes[i]
          f.y += f.v * dt
          f.x += (wind * f.z + Math.sin(t * f.sway + f.phase) * 14 * f.z) * dt
          if (f.y > H + 10) flakes[i] = spawn(true)
          else if (f.x > W + 10) f.x = -10
          else if (f.x < -10) f.x = W + 10
        }
        draw()
      },
    }
  },
}

function makeSprite(dark: boolean) {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  const rgb = dark ? '255,255,255' : '150,172,200'
  grad.addColorStop(0, `rgba(${rgb},1)`)
  grad.addColorStop(0.45, `rgba(${rgb},0.85)`)
  grad.addColorStop(1, `rgba(${rgb},0)`)
  g.fillStyle = grad
  g.fillRect(0, 0, 32, 32)
  return c
}
