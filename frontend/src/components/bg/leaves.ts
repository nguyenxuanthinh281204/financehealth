import { isDarkTheme, type BgEffectDef } from './types'

/**
 * Gió lá rơi: lá thu bay theo gió từ trái sang, xoay và lật (co giãn theo cos để giả 3D),
 * gió thổi thành từng cơn; vài vệt gió mảnh lướt qua cho thấy hướng gió.
 * Lá vẽ sẵn thành ảnh nhỏ theo từng màu rồi drawImage có xoay, nên rất nhẹ.
 */
const COLORS = ['#d9662b', '#c4452c', '#e9a23b', '#b8732d', '#8c4a24', '#d8b13a', '#9aa63c']

const CONFIG = {
  soft: { perKpx: 22, gust: 1 },
  strong: { perKpx: 44, gust: 1.6 },
} as const

interface Leaf {
  x: number; y: number; vx: number; vy: number; z: number
  rot: number; spin: number; flip: number; flipSpeed: number; sprite: number
}
interface Streak { x: number; y: number; len: number; life: number; v: number; curve: number }

export const leaves: BgEffectDef = {
  height: { soft: 1, strong: 1 },
  scale: () => 1,
  create(canvas, level) {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    const cfg = CONFIG[level]
    const sprites = COLORS.map(makeLeafSprite)
    let W = 0, H = 0, t = Math.random() * 50
    let items: Leaf[] = []
    let streaks: Streak[] = []
    let dark = isDarkTheme(), themeCheck = 0

    const wind = () => {
      // Gió nền + cơn gió mạnh lên rồi lặng dần
      const gust = Math.max(0, Math.sin(t * 0.21) * Math.sin(t * 0.07 + 1)) ** 2
      return (40 + 160 * gust * cfg.gust) * (1 + 0.15 * Math.sin(t * 1.3))
    }

    const spawn = (anywhere: boolean): Leaf => {
      const z = 0.45 + Math.random() * 0.55
      const fromLeft = !anywhere && Math.random() < 0.55
      return {
        x: anywhere ? Math.random() * W : fromLeft ? -30 : Math.random() * W * 0.9,
        y: anywhere ? Math.random() * H : fromLeft ? Math.random() * H * 0.7 : -30,
        vx: 30, vy: 20 + 30 * z, z,
        rot: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 3,
        flip: Math.random() * Math.PI * 2,
        flipSpeed: 1.5 + Math.random() * 3,
        sprite: (Math.random() * sprites.length) | 0,
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      // Vệt gió
      ctx.lineCap = 'round'
      for (const s of streaks) {
        const a = Math.sin(Math.PI * Math.min(1, s.life)) * (dark ? 0.22 : 0.3)
        ctx.strokeStyle = dark ? `rgba(220,230,240,${a})` : `rgba(120,130,125,${a})`
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.quadraticCurveTo(s.x + s.len * 0.5, s.y + s.curve, s.x + s.len, s.y)
        ctx.stroke()
      }
      for (const l of items) {
        const size = 18 + 20 * l.z
        ctx.save()
        ctx.translate(l.x, l.y)
        ctx.rotate(l.rot)
        ctx.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(l.flip)))
        ctx.globalAlpha = (0.6 + 0.4 * l.z) * (dark ? 0.85 : 1)
        ctx.drawImage(sprites[l.sprite], -size / 2, -size / 2, size, size)
        ctx.restore()
      }
      ctx.globalAlpha = 1
    }

    return {
      resize(w, h) {
        W = w; H = h
        const n = Math.max(6, Math.round((W / 1000) * cfg.perKpx * (H / 800)))
        items = Array.from({ length: n }, () => spawn(true))
        streaks = []
        draw()
      },
      frame(dt) {
        if (themeCheck++ % 30 === 0) dark = isDarkTheme()
        t += dt
        const w = wind()
        for (let i = 0; i < items.length; i++) {
          const l = items[i]
          // Lá nhẹ bị gió kéo dần về vận tốc gió, rơi chậm có đung đưa
          l.vx += (w * (0.6 + 0.6 * l.z) - l.vx) * Math.min(1, dt * 1.2)
          l.vy = (22 + 34 * l.z) + Math.sin(l.flip) * 18
          l.x += l.vx * dt
          l.y += l.vy * dt
          l.rot += (l.spin + l.vx * 0.004) * dt
          l.flip += l.flipSpeed * dt * (0.6 + w / 200)
          if (l.x > W + 40 || l.y > H + 40) items[i] = spawn(false)
        }
        if (Math.random() < dt * (0.6 + w / 80) && streaks.length < 8) {
          streaks.push({ x: -100 + Math.random() * W * 0.8, y: Math.random() * H, len: 80 + Math.random() * 160, life: 0, v: w * 2.2 + 200, curve: (Math.random() - 0.5) * 30 })
        }
        streaks = streaks.filter((s) => {
          s.x += s.v * dt
          s.life += dt * 0.9
          return s.life < 1
        })
        draw()
      },
    }
  },
}

/** Vẽ một chiếc lá (phiến nhọn hai đầu, gân giữa, cuống) lên ảnh 64×64. */
function makeLeafSprite(color: string) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  g.translate(32, 32)
  g.rotate(-Math.PI / 4)
  g.beginPath()
  g.moveTo(0, -26)
  g.bezierCurveTo(16, -16, 16, 10, 0, 22)
  g.bezierCurveTo(-16, 10, -16, -16, 0, -26)
  g.fillStyle = color
  g.fill()
  // Đổ bóng nhẹ một nửa cho có khối
  g.save()
  g.clip()
  g.fillStyle = 'rgba(0,0,0,0.12)'
  g.fillRect(0, -30, 20, 60)
  g.restore()
  g.strokeStyle = 'rgba(60,30,10,0.45)'
  g.lineWidth = 1.4
  g.beginPath()
  g.moveTo(0, -22)
  g.lineTo(0, 28)
  g.stroke()
  g.lineWidth = 0.9
  for (let i = -12; i <= 10; i += 7) {
    g.beginPath(); g.moveTo(0, i); g.lineTo(8, i - 6); g.stroke()
    g.beginPath(); g.moveTo(0, i); g.lineTo(-8, i - 6); g.stroke()
  }
  return c
}
