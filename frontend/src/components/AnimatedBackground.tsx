import { useEffect, useRef } from 'react'
import { useBackground, type BgEffect, type BgLevel } from '../lib/background'
import { fire } from './bg/fire'
import { rain } from './bg/rain'
import type { BgEffectDef } from './bg/types'
import { waves } from './bg/waves'

/**
 * Nền động (lửa / sóng nước / mưa) nằm sau toàn bộ giao diện, không bắt chạm.
 * Giới hạn 30 khung/giây, dừng khi tab ẩn, đứng yên một khung khi máy bật "giảm chuyển động".
 */
const FPS = 30
const EFFECTS: Record<Exclude<BgEffect, 'off'>, BgEffectDef> = { fire, waves, rain }

export default function AnimatedBackground() {
  const { effect, level } = useBackground()

  useEffect(() => {
    const root = document.documentElement
    if (effect === 'off') root.removeAttribute('data-bg')
    else root.setAttribute('data-bg', effect)
    root.setAttribute('data-bg-level', level)
    return () => { root.removeAttribute('data-bg'); root.removeAttribute('data-bg-level') }
  }, [effect, level])

  if (effect === 'off') return null
  return <BgCanvas key={`${effect}-${level}`} effect={effect} level={level} />
}

function BgCanvas({ effect, level }: { effect: Exclude<BgEffect, 'off'>; level: BgLevel }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const def = EFFECTS[effect]
  const height = def.height[level]

  useEffect(() => {
    const canvas = ref.current
    const renderer = canvas && def.create(canvas, level)
    if (!canvas || !renderer) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let W = 0, H = 0

    const size = () => {
      const s = def.scale()
      return [Math.max(8, Math.ceil(window.innerWidth / s)), Math.max(8, Math.ceil((window.innerHeight * height) / s)), s] as const
    }
    const fit = () => {
      ;[W, H] = size()
      canvas.width = W
      canvas.height = H
      renderer.resize(W, H)
    }

    let raf = 0, last = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (now - last < 1000 / FPS - 2) return
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / FPS
      last = now
      renderer.frame(dt)
    }
    const start = () => {
      cancelAnimationFrame(raf)
      last = 0
      if (reduced.matches || document.hidden) return
      raf = requestAnimationFrame(loop)
    }

    // Thanh địa chỉ trên điện thoại co giãn liên tục: chỉ dựng lại khi đổi kích thước đáng kể
    let resizeTimer = 0
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        const [w, h, s] = size()
        if (w !== W || Math.abs(h - H) * s > 60) { fit(); start() }
      }, 150)
    }

    fit()
    start()
    window.addEventListener('resize', onResize)
    document.addEventListener('visibilitychange', start)
    reduced.addEventListener('change', start)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      document.removeEventListener('visibilitychange', start)
      reduced.removeEventListener('change', start)
    }
  }, [def, level, height])

  return <canvas ref={ref} className={`bg-anim bg-${effect}`} aria-hidden="true" style={{ height: `${height * 100}vh` }} />
}
