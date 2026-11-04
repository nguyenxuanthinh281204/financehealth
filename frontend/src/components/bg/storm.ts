import { rain } from './rain'
import { isDarkTheme, type BgEffectDef } from './types'

/**
 * Giông sét: mưa nặng hạt + thỉnh thoảng một tia sét rẽ nhánh kèm ánh chớp.
 * An toàn cho người nhạy cảm ánh sáng: mỗi lần sét cách nhau 7–16 giây, mỗi lần tối đa 2 nhịp chớp
 * (dưới 3 lần/giây), ánh chớp phủ nhẹ (độ đậm ≤ 0.22) và mờ dần chứ không bật tắt gắt.
 * Khi máy bật giảm chuyển động thì chỉ còn khung mưa đứng yên, không có chớp.
 */
interface Bolt { segs: [number, number, number, number, number][]; age: number; life: number }

export const storm: BgEffectDef = {
  height: { soft: 1, strong: 1 },
  scale: () => 1,
  create(canvas, level) {
    const base = rain.create(canvas, level)
    const ctx = canvas.getContext('2d')
    if (!base || !ctx) return null
    let W = 0, H = 0
    let bolt: Bolt | null = null
    let flash = 0 // độ sáng ánh chớp hiện tại
    let pulses: { in: number; power: number }[] = [] // các nhịp chớp sắp tới (giây còn lại, độ sáng)
    let nextStrike = 0.8 + Math.random() * 1.2 // tia đầu tiên đến sớm để thấy ngay khi vừa chọn
    let dark = isDarkTheme(), themeCheck = 0
    const peak = level === 'strong' ? 0.22 : 0.15
    const gap = level === 'strong' ? [7, 12] : [10, 16]

    const strike = () => {
      bolt = makeBolt(W, H)
      // Nhịp chớp chính + đôi khi một nhịp dư âm yếu hơn sau ~0.35 giây
      pulses = [{ in: 0, power: peak }]
      if (Math.random() < 0.6) pulses.push({ in: 0.35, power: peak * 0.6 })
      nextStrike = gap[0] + Math.random() * (gap[1] - gap[0])
    }

    const drawOverlay = () => {
      if (flash > 0.004) {
        ctx.fillStyle = dark ? `rgba(200,215,255,${flash})` : `rgba(255,255,255,${flash * 1.6})`
        ctx.fillRect(0, 0, W, H)
      }
      if (bolt) {
        const a = Math.max(0, 1 - bolt.age / bolt.life)
        ctx.save()
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.shadowColor = dark ? 'rgba(170,190,255,0.9)' : 'rgba(120,140,220,0.8)'
        ctx.shadowBlur = 14
        for (const [x1, y1, x2, y2, w] of bolt.segs) {
          ctx.strokeStyle = dark ? `rgba(235,240,255,${a})` : `rgba(90,105,170,${a * 0.85})`
          ctx.lineWidth = w
          ctx.beginPath()
          ctx.moveTo(x1, y1)
          ctx.lineTo(x2, y2)
          ctx.stroke()
        }
        ctx.restore()
      }
    }

    return {
      resize(w, h) {
        W = w; H = h
        base.resize(w, h)
      },
      frame(dt) {
        if (themeCheck++ % 30 === 0) dark = isDarkTheme()
        base.frame(dt)
        nextStrike -= dt
        if (nextStrike <= 0) strike()
        pulses = pulses.filter((p) => {
          p.in -= dt
          if (p.in > 0) return true
          flash = Math.max(flash, p.power)
          return false
        })
        flash *= Math.exp(-dt * 6) // mờ dần mượt
        if (bolt) {
          bolt.age += dt
          if (bolt.age > bolt.life) bolt = null
        }
        drawOverlay()
      },
    }
  },
}

/** Tia sét gấp khúc từ mép trên xuống, có vài nhánh rẽ mảnh hơn. */
function makeBolt(W: number, H: number): Bolt {
  const segs: Bolt['segs'] = []
  const branch = (x: number, y: number, len: number, width: number, angle: number, depth: number) => {
    const steps = Math.max(4, Math.round(len / 22))
    for (let i = 0; i < steps; i++) {
      const a = angle + (Math.random() - 0.5) * 0.9
      const step = len / steps
      const nx = x + Math.sin(a) * step, ny = y + Math.cos(a) * step
      segs.push([x, y, nx, ny, width])
      if (depth < 2 && Math.random() < 0.12) branch(nx, ny, len * 0.35, width * 0.5, a + (Math.random() < 0.5 ? -0.6 : 0.6), depth + 1)
      x = nx; y = ny
      width *= 0.97
    }
  }
  branch(W * (0.15 + Math.random() * 0.7), -10, H * (0.45 + Math.random() * 0.3), 2.6, (Math.random() - 0.5) * 0.4, 0)
  return { segs, age: 0, life: 0.45 }
}
